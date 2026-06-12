import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';
import { readLocalFileAsArrayBuffer } from './messaging';

/// Structured result of a résumé parse — mirrors the parse-resume edge
/// function's output schema. All fields present; "" / [] means absent.
export interface ParsedResume {
  name: string;
  headline: string;
  skills: string[];
  links: { github: string; linkedin: string; portfolio: string };
  experience: { title: string; org: string; summary: string }[];
  education: { school: string; degree: string; year: string }[];
  portfolio: { title: string; description: string; link: string }[];
}

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

async function invokeParse(body: Record<string, unknown>): Promise<ParsedResume> {
  const { data, error } = await supabase.functions.invoke('parse-resume', { body });
  if (error) throw error;
  if (data && typeof data === 'object' && 'error' in data) {
    throw new Error(String((data as { error: unknown }).error));
  }
  return data as ParsedResume;
}

/// Upload a picked file (PDF / DOCX / image) to the private `resumes` bucket.
async function uploadToResumes(
  userId: string,
  uri: string,
  filename: string,
  contentType: string,
): Promise<string> {
  const path = `${userId}/${filename}`;
  const bytes = await readLocalFileAsArrayBuffer(uri);
  const { error } = await supabase.storage
    .from('resumes')
    .upload(path, bytes, { contentType, upsert: true });
  if (error) throw error;
  return path;
}

// ── 1. Paste text ───────────────────────────────────────────────────
// The universal path — works for a Google Doc / Word doc / anything: the
// user pastes the text, no file handling. Goes straight to the model.
export function parseResumeText(text: string): Promise<ParsedResume> {
  return invokeParse({ kind: 'text', text });
}

// ── 2. File (PDF or Word) ───────────────────────────────────────────
// The iOS picker surfaces Files / iCloud / Google Drive / Dropbox as
// locations, so this reaches wherever the file actually lives.
export async function pickAndParseDocument(userId: string): Promise<ParsedResume | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf', DOCX_MIME],
    copyToCacheDirectory: true,
  });
  if (res.canceled) return null;
  const asset = res.assets[0];
  if (!asset?.uri) return null;

  const name = (asset.name ?? asset.uri).toLowerCase();
  const isDocx = name.endsWith('.docx') || (asset.mimeType ?? '').includes('word');
  const kind = isDocx ? 'docx' : 'pdf';
  const ext = isDocx ? 'docx' : 'pdf';
  const contentType = isDocx ? DOCX_MIME : 'application/pdf';

  const path = await uploadToResumes(userId, asset.uri, `resume.${ext}`, contentType);
  return invokeParse({ kind, path });
}

// ── 3. Photo of the résumé ──────────────────────────────────────────
// Snap or pick a screenshot/photo — Claude vision reads it. Very
// mobile-native for someone who only has a picture of their résumé.
export async function pickAndParsePhoto(userId: string): Promise<ParsedResume | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error('Photo access is needed to import a résumé photo.');
  const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.9 });
  if (res.canceled) return null;
  const asset = res.assets[0];
  if (!asset?.uri) return null;

  const ext = (asset.uri.split('.').pop() ?? 'jpg').toLowerCase();
  const safeExt = ['png', 'webp', 'gif', 'jpg', 'jpeg'].includes(ext) ? ext : 'jpg';
  const contentType =
    safeExt === 'png' ? 'image/png'
    : safeExt === 'webp' ? 'image/webp'
    : safeExt === 'gif' ? 'image/gif'
    : 'image/jpeg';

  const path = await uploadToResumes(userId, asset.uri, `resume-photo.${safeExt}`, contentType);
  return invokeParse({ kind: 'image', path });
}
