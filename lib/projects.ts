import { supabase } from './supabase';
import { readLocalFileAsArrayBuffer } from './messaging';

/// Format a Date to a `YYYY-MM-DD` string for a Postgres `date` column, using
/// LOCAL calendar parts (not `toISOString`, which would shift the day in
/// negative-offset timezones).
export function toDateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/// Upload a picked cover image to the `project-images` bucket and return its
/// public URL. Path convention `{ownerId}/{projectId}.{ext}` with upsert:true so
/// replacing a project's cover overwrites in place. A cache-busting query param
/// forces the CDN/Image cache to refresh the swapped image.
/// Reads real bytes via readLocalFileAsArrayBuffer (fetch().blob() yields
/// 0-byte uploads on RN).
export async function uploadProjectImage(
  ownerId: string,
  projectId: string,
  localUri: string,
  nowMs: number,
): Promise<string> {
  const ext = (localUri.match(/\.([a-zA-Z0-9]+)$/)?.[1] ?? 'jpg').toLowerCase();
  const path = `${ownerId}/${projectId}.${ext}`;
  const bytes = await readLocalFileAsArrayBuffer(localUri);
  const { error } = await supabase.storage
    .from('project-images')
    .upload(path, bytes, {
      contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
      upsert: true,
    });
  if (error) throw error;
  const { data } = supabase.storage.from('project-images').getPublicUrl(path);
  return `${data.publicUrl}?v=${nowMs}`;
}
