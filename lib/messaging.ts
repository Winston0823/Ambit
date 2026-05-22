import { supabase } from './supabase';

// ─── Types ──────────────────────────────────────────────────────────

export interface MessageRow {
  id:              string;
  conversation_id: string;
  sender_id:       string;
  body:            string | null;
  attachment_url:  string | null;
  parent_id:       string | null;
  edited_at:       string | null;
  deleted_at:      string | null;
  created_at:      string;
}

export interface ReactionRow {
  message_id: string;
  user_id:    string;
  emoji:      string;
}

export interface InboxItem {
  conversation_id:             string;
  project_id:                  string;
  project_title:               string;
  partner_id:                  string;
  partner_name:                string;
  partner_photo_url:           string | null;
  last_message_at:             string;
  last_message_body:           string | null;
  last_message_attachment_url: string | null;
  last_message_sender_id:      string | null;
  last_message_deleted:        boolean;
  unread_count:                number;
}

export interface SearchHit {
  message_id:      string;
  conversation_id: string;
  body:            string;
  created_at:      string;
  partner_name:    string;
  project_title:   string;
  rank:            number;
}

// ─── Conversations ──────────────────────────────────────────────────

/// Create-or-find a conversation and post the first message atomically.
/// Returns the conversation id so the caller can navigate into the thread.
export async function startConversationWithMessage(args: {
  projectId: string;
  seekerId:  string;
  body:      string;
}): Promise<string> {
  const { data, error } = await supabase.rpc('start_conversation_with_message', {
    p_project_id:    args.projectId,
    p_seeker_id:     args.seekerId,
    p_first_message: args.body,
  });
  if (error) throw error;
  return data as string;
}

export async function getInbox(): Promise<InboxItem[]> {
  const { data, error } = await supabase.rpc('get_inbox');
  if (error) throw error;
  return (data ?? []) as InboxItem[];
}

export async function markConversationRead(conversationId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_conversation_read', {
    p_conversation_id: conversationId,
  });
  if (error) console.warn('mark_conversation_read failed:', error.message);
}

// ─── Messages ───────────────────────────────────────────────────────

export async function listMessages(
  conversationId: string,
  opts: { limit?: number; before?: string } = {},
): Promise<MessageRow[]> {
  let q = supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(opts.limit ?? 50);
  if (opts.before) q = q.lt('created_at', opts.before);
  const { data, error } = await q;
  if (error) throw error;
  // Return ascending (oldest first) for the UI — easier to render.
  return (data ?? []).reverse() as MessageRow[];
}

export async function sendTextMessage(args: {
  conversationId: string;
  senderId:       string;
  body:           string;
  parentId?:      string | null;
}): Promise<MessageRow> {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: args.conversationId,
      sender_id:       args.senderId,
      body:            args.body.trim(),
      parent_id:       args.parentId ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as MessageRow;
}

export async function sendImageMessage(args: {
  conversationId: string;
  senderId:       string;
  localUri:       string;
  parentId?:      string | null;
}): Promise<MessageRow> {
  // Read the local file as bytes. expo-file-system would also work; using
  // fetch() keeps us dep-free here (it works for file:// URIs in RN).
  const res = await fetch(args.localUri);
  const blob = await res.blob();
  const ext = (args.localUri.match(/\.([a-zA-Z0-9]+)$/)?.[1] ?? 'jpg').toLowerCase();
  const path = `${args.conversationId}/${crypto.randomUUID()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from('chat-attachments')
    .upload(path, blob, {
      contentType: blob.type || `image/${ext}`,
      upsert: false,
    });
  if (upErr) throw upErr;

  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: args.conversationId,
      sender_id:       args.senderId,
      attachment_url:  path,
      parent_id:       args.parentId ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as MessageRow;
}

/// Returns a short-lived signed URL for rendering an attachment in an
/// <Image>. Signed URLs are cheap to mint; we don't bother caching them.
export async function signAttachmentUrl(path: string, ttlSeconds = 3600): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('chat-attachments')
    .createSignedUrl(path, ttlSeconds);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export async function editMessage(messageId: string, body: string): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .update({ body: body.trim(), edited_at: new Date().toISOString() })
    .eq('id', messageId);
  if (error) throw error;
}

/// Soft delete — preserves replies and reactions. The bubble UI will
/// render a tombstone ("Message deleted") instead of the body.
export async function deleteMessage(messageId: string): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .update({ deleted_at: new Date().toISOString(), body: null, attachment_url: null })
    .eq('id', messageId);
  if (error) throw error;
}

// ─── Reactions ──────────────────────────────────────────────────────

export async function listReactions(conversationId: string): Promise<ReactionRow[]> {
  const { data, error } = await supabase
    .from('message_reactions')
    .select('message_id, user_id, emoji, messages!inner(conversation_id)')
    .eq('messages.conversation_id', conversationId);
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    message_id: r.message_id,
    user_id:    r.user_id,
    emoji:      r.emoji,
  }));
}

export async function toggleReaction(args: {
  messageId: string;
  userId:    string;
  emoji:     string;
}): Promise<void> {
  // Try insert; if it conflicts (already exists), delete instead. We
  // could do this with one round trip via an RPC, but two queries keep
  // the migration smaller.
  const { error: insertErr } = await supabase
    .from('message_reactions')
    .insert({
      message_id: args.messageId,
      user_id:    args.userId,
      emoji:      args.emoji,
    });
  if (insertErr && insertErr.code === '23505') {
    await supabase
      .from('message_reactions')
      .delete()
      .eq('message_id', args.messageId)
      .eq('user_id', args.userId)
      .eq('emoji', args.emoji);
  } else if (insertErr) {
    throw insertErr;
  }
}

// ─── Search ─────────────────────────────────────────────────────────

export async function searchMessages(query: string, limit = 50): Promise<SearchHit[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const { data, error } = await supabase.rpc('search_messages', {
    p_query: trimmed,
    p_limit: limit,
  });
  if (error) throw error;
  return (data ?? []) as SearchHit[];
}
