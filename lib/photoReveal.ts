import { supabase } from './supabase';

/// The ONLY client read path for other users' photos. The server-side
/// fetch_peer_photos RPC (migration 039) returns a row per peer whose photo
/// the caller is allowed to see: self, or a mutual conversation (both sides
/// have sent a message, thread not passed/auto_declined). Absence from the
/// result means "not revealed" — render the monster mark instead.
export async function fetchPeerPhotos(peerIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (peerIds.length === 0) return out;
  const { data, error } = await supabase.rpc('fetch_peer_photos', {
    peer_ids: Array.from(new Set(peerIds)),
  });
  if (error || !data) return out;
  for (const row of data as { user_id: string; photo_url: string | null }[]) {
    if (row.photo_url) out.set(row.user_id, row.photo_url);
  }
  return out;
}
