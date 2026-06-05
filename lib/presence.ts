import { supabase } from './supabase';

/// Stamp the signed-in user as active now (profiles.last_active_at). Called on
/// app foreground + when opening a thread. Fire-and-forget.
export async function touchPresence(userId: string): Promise<void> {
  try {
    await supabase.from('profiles').update({ last_active_at: new Date().toISOString() }).eq('id', userId);
  } catch {
    /* presence is best-effort */
  }
}

/// Active within the last 3 minutes = "online".
export function isOnline(iso: string | null | undefined): boolean {
  if (!iso) return false;
  return Date.now() - new Date(iso).getTime() < 3 * 60 * 1000;
}

/// "Active now" / "Active 5m ago" / "Active 2h ago" / "Active 3d ago". Null if
/// we've never seen them active.
export function presenceLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 3) return 'Active now';
  if (mins < 60) return `Active ${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Active ${hrs}h ago`;
  return `Active ${Math.floor(hrs / 24)}d ago`;
}
