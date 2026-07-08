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

/// The owner's PRIVATE per-conversation funnel stage — their own CRM tag for
/// a candidate, independent of the shared `status` hire flow. Persisted as
/// free text in `conversations.owner_stage` (set via the owner-only
/// `set_owner_stage` RPC). Owner-only: the seeker never sees or sets it.
export type OwnerStage = 'new' | 'screening' | 'interviewing' | 'finalist';

export const OWNER_STAGES: { value: OwnerStage; label: string }[] = [
  { value: 'new',          label: 'New' },
  { value: 'screening',    label: 'Screening' },
  { value: 'interviewing', label: 'Interviewing' },
  { value: 'finalist',     label: 'Finalist' },
];

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

/// Revert a `hired_pending` conversation back to `active`. Used by BOTH
/// sides of a stuck proposal: the recipient's "Not yet" (decline the
/// proposal) and the proposer's "Withdraw proposal". The server RPC
/// (migration 029) guards that the caller is a participant and that the
/// status is actually `hired_pending`, then clears `hired_proposed_by`
/// so the loop is fully reset. Idempotent-ish: a no-op raise if not
/// pending is surfaced to the caller.
export async function revertHireProposal(conversationId: string): Promise<void> {
  const { error } = await supabase.rpc('revert_hire_proposal', {
    p_conversation_id: conversationId,
  });
  if (error) throw new Error(error.message);
}

/// Set the owner's private funnel stage for a conversation. Owner-only on the
/// server (the RPC guards `owner_id = auth.uid()`); a seeker call is a no-op.
export async function updateOwnerStage(
  conversationId: string,
  stage: OwnerStage,
): Promise<void> {
  const { error } = await supabase.rpc('set_owner_stage', {
    p_conversation_id: conversationId,
    p_stage: stage,
  });
  if (error) throw new Error(error.message);
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

// ─── Countdown ──────────────────────────────────────────────────────

export interface AutoCloseCountdown {
  /// Whole minutes remaining until auto-close fires. Negative if past
  /// the deadline (caller should treat as already auto-declined).
  minutesLeft: number;
  /// Display label, collapses units at human thresholds:
  ///   ≥ 1 day  → "2d 14h left"
  ///   < 1 day  → "21h to reply"
  ///   < 1 hour → "14m to reply"
  label:       string;
  /// True when remaining is under 24h. UI uses this to flip the chip
  /// from outline → solid ink (the "urgent" tier in the v4 mock).
  urgent:      boolean;
}

/// Compute the time-to-auto-close for a conversation whose recipient
/// has not yet replied. Returns null when the deadline has passed or
/// the input timestamp is missing — both cases should render as
/// "auto-closed" rather than a live countdown.
export function getAutoCloseCountdown(
  autoDeclineAt: string | null,
  now: Date = new Date(),
): AutoCloseCountdown | null {
  if (!autoDeclineAt) return null;
  const deadline = new Date(autoDeclineAt).getTime();
  const minutesLeft = Math.floor((deadline - now.getTime()) / 60_000);
  if (minutesLeft <= 0) return null;

  let label: string;
  if (minutesLeft >= 24 * 60) {
    const days  = Math.floor(minutesLeft / (24 * 60));
    const hours = Math.floor((minutesLeft - days * 24 * 60) / 60);
    label = hours > 0 ? `${days}d ${hours}h left` : `${days}d left`;
  } else if (minutesLeft >= 60) {
    const hours = Math.floor(minutesLeft / 60);
    label = `${hours}h to reply`;
  } else {
    label = `${minutesLeft}m to reply`;
  }

  return {
    minutesLeft,
    label,
    urgent: minutesLeft < 24 * 60,
  };
}
