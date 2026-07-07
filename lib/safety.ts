import { supabase } from './supabase';

/// UGC safety client helpers (App Store Guideline 1.2). Thin wrappers over the
/// block/unblock/report RPCs from migration 031_safety.sql.

export const REPORT_REASONS = [
  'Spam or scam',
  'Harassment or hate',
  'Inappropriate content',
  'Fake profile or impersonation',
  'Other',
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

/// What's being reported. A conversation/message report still carries the
/// reported user's id so moderation can act on the person.
export interface ReportTarget {
  reportedUserId: string;
  conversationId?: string | null;
  messageId?: string | null;
}

/// Block a user. Hides them from feed + inbox both ways and prevents messaging
/// (enforced server-side). Idempotent.
export async function blockUser(blockedId: string): Promise<void> {
  const { error } = await supabase.rpc('block_user', { p_blocked_id: blockedId });
  if (error) throw error;
}

export async function unblockUser(blockedId: string): Promise<void> {
  const { error } = await supabase.rpc('unblock_user', { p_blocked_id: blockedId });
  if (error) throw error;
}

/// File a content report. Lands in `content_reports` for service-role review.
export async function reportContent(target: ReportTarget, reason: ReportReason, detail?: string): Promise<void> {
  const { error } = await supabase.rpc('report_content', {
    p_reported_user_id: target.reportedUserId,
    p_reason: reason,
    p_conversation_id: target.conversationId ?? null,
    p_message_id: target.messageId ?? null,
    p_detail: detail ?? null,
  });
  if (error) throw error;
}
