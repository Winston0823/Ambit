import { supabase } from './supabase';

// ─── Constants ──────────────────────────────────────────────────────

/// Canonical reasons surfaced in the PassReasonSheet. Stored as plain
/// text on `conversations.pass_reason` — kept short so the founder's
/// constructive feedback reads cleanly on the candidate side.
export const PASS_REASONS = [
  'Looking for more experience',
  'Role has been filled',
  'Skills don\'t match this role',
  'Timing isn\'t right',
  'Other',
] as const;

export type PassReason = typeof PASS_REASONS[number];

/// State machine values that match the DB check constraint on
/// `conversations.status`. Anything outside this union is a schema bug.
export type ConversationStatus =
  | 'active'
  | 'passed'
  | 'hired_pending'
  | 'hired'
  | 'auto_declined';

/// Message kind — `'user'` for normal participant messages; the rest are
/// inserted by closure-loop RPCs and rendered as centered banner bubbles
/// rather than speech bubbles.
export type MessageKind =
  | 'user'
  | 'system_pass'
  | 'system_hire_proposed'
  | 'system_hired'
  | 'system_auto_declined';

// ─── RPCs ───────────────────────────────────────────────────────────

/// Pass on an active conversation with a reason. Caller must be one of
/// the two participants; the reason is shown to the other side as a
/// `system_pass` system message. Idempotent if already closed.
export async function passConversation(
  conversationId: string,
  reason: PassReason | string,
): Promise<void> {
  const { error } = await supabase.rpc('pass_conversation', {
    p_conversation_id: conversationId,
    p_reason: reason,
  });
  if (error) throw error;
}

/// Propose marking the conversation as Hired. The OTHER party must call
/// confirmHire to finalize. While pending, both sides see a banner.
export async function proposeHire(conversationId: string): Promise<void> {
  const { error } = await supabase.rpc('propose_hire', {
    p_conversation_id: conversationId,
  });
  if (error) throw error;
}

/// Confirm a hire that the other party proposed. The proposer cannot
/// confirm their own proposal — the RPC will raise in that case.
export async function confirmHire(conversationId: string): Promise<void> {
  const { error } = await supabase.rpc('confirm_hire', {
    p_conversation_id: conversationId,
  });
  if (error) throw error;
}

/// Force a recompute of the response-rate cache for the current user.
/// Normally triggers handle this, but the profile screen can call it
/// on focus as a refresh.
export async function recomputeMyResponseMetrics(userId: string): Promise<void> {
  const { error } = await supabase.rpc('recompute_response_metrics', {
    p_user_id: userId,
  });
  if (error) console.warn('recompute_response_metrics failed:', error.message);
}

// ─── Display helpers ────────────────────────────────────────────────

/// Render an avg-response-minutes int as a short human label.
/// 4 → "~4min", 75 → "~1hr", 1500 → "~1d".
export function formatResponseTime(minutes: number | null | undefined): string | null {
  if (minutes == null) return null;
  if (minutes < 60) return `~${minutes}min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `~${hours}hr`;
  const days = Math.round(hours / 24);
  return `~${days}d`;
}

/// Render a response-rate (0–1) as "NN%". Returns null if rate is null.
export function formatResponseRate(rate: number | null | undefined): string | null {
  if (rate == null) return null;
  return `${Math.round(rate * 100)}%`;
}
