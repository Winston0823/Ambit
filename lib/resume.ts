import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';
import { readLocalFileAsArrayBuffer } from './messaging';
import { SKILL_CATEGORIES } from '../data/mock';

// The app's canonical skill chips (what the profile skill picker offers).
const CANON_SKILLS = SKILL_CATEGORIES.flatMap((c) => c.tags);

/// Normalize free-text résumé skills against the app's skill taxonomy so they
/// snap to real chips: case-insensitive match → canonical chip; otherwise keep
/// the trimmed free-text (the picker allows customs). De-duplicated, order
/// preserved. The "AI proposes, code verifies" QC step.
export function normalizeResumeSkills(raw: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of raw) {
    const trimmed = (s ?? '').trim();
    if (!trimmed) continue;
    const match = CANON_SKILLS.find((c) => c.toLowerCase() === trimmed.toLowerCase());
    const skill = match ?? trimmed;
    const key = skill.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(skill);
    }
  }
  return out;
}

/// Normalize a résumé-extracted URL for storage: trim, drop if empty, and
/// prefix `https://` when the model returned a bare host ("github.com/x").
/// Returns null when there's nothing usable (empty, or a bare handle with no
/// dot) — callers use null to mean "the résumé didn't carry this link", so an
/// absent link never overwrites one the user already has.
export function normalizeResumeUrl(raw: string | null | undefined): string | null {
  const t = (raw ?? '').trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  if (!t.includes('.')) return null;
  return `https://${t}`;
}

/// Map a parsed résumé's links onto the `profiles` URL columns, keeping only
/// the ones the résumé actually carried. Absent links are omitted entirely
/// (not nulled) so applying a résumé never wipes an existing profile link.
export function resumeLinksPatch(
  links: ParsedResume['links'],
): Partial<{ github_url: string; linkedin_url: string; portfolio_url: string }> {
  const patch: Record<string, string> = {};
  const gh = normalizeResumeUrl(links.github);
  const li = normalizeResumeUrl(links.linkedin);
  const pf = normalizeResumeUrl(links.portfolio);
  if (gh) patch.github_url = gh;
  if (li) patch.linkedin_url = li;
  if (pf) patch.portfolio_url = pf;
  return patch;
}

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
