import { supabase } from './supabase';

/// Canonical report reasons shown in the report sheet. Kept short so they
/// fit the content_reports.reason column (<= 60 chars) and read as a menu.
export const REPORT_REASONS = [
  'Harassment or bullying',
  'Spam or scam',
  'Inappropriate content',
  'Impersonation',
  'Something else',
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

/// Block a user. After this, the caller should archive/leave the
/// conversation locally. RLS scopes the row to the caller as blocker.
export async function blockUser(blockedId: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const me = auth?.user?.id;
  if (!me) throw new Error('Not signed in.');
  const { error } = await supabase
    .from('blocked_users')
    .upsert({ blocker_id: me, blocked_id: blockedId }, { onConflict: 'blocker_id,blocked_id' });
  if (error) throw error;
}

export async function unblockUser(blockedId: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const me = auth?.user?.id;
  if (!me) throw new Error('Not signed in.');
  const { error } = await supabase
    .from('blocked_users')
    .delete()
    .eq('blocker_id', me)
    .eq('blocked_id', blockedId);
  if (error) throw error;
}

/// File a report against a user, optionally scoped to a conversation or
/// a specific message.
export async function reportUser(args: {
  reportedUserId: string;
  reason: ReportReason | string;
  conversationId?: string | null;
  messageId?: string | null;
  details?: string;
}): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const me = auth?.user?.id;
  if (!me) throw new Error('Not signed in.');
  const { error } = await supabase.from('content_reports').insert({
    reporter_id: me,
    reported_user_id: args.reportedUserId,
    conversation_id: args.conversationId ?? null,
    message_id: args.messageId ?? null,
    reason: args.reason,
    details: args.details?.trim() || null,
  });
  if (error) throw error;
}
