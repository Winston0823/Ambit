import { randomUUID } from 'expo-crypto';
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

/// Most-recent conversation id between the two users, in either
/// orientation — owner/seeker or seeker/owner. Null if none exists.
///
/// The conversations table's unique constraint is (seeker_id, project_id)
/// — so the existing RPC dedups by (seeker, project), not by user pair.
/// Reach-out wants user-pair dedup ("my chat with Noah" not "my chat
/// with Noah about Project A"), so we run our own lookup before falling
/// back to the create RPC. Two queries because the participant pair can
/// be stored in either orientation; we pick whichever returned a row, or
/// the more recent one if both did (rare; only possible if the same
/// person owns one project AND is a seeker on another the caller owns).
export async function findExistingConversation(
  myUserId: string,
  otherUserId: string,
): Promise<string | null> {
  const [iAmOwner, iAmSeeker] = await Promise.all([
    supabase
      .from('conversations')
      .select('id, last_message_at')
      .eq('owner_id', myUserId)
      .eq('seeker_id', otherUserId)
      .order('last_message_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('conversations')
      .select('id, last_message_at')
      .eq('seeker_id', myUserId)
      .eq('owner_id', otherUserId)
      .order('last_message_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const candidates = [iAmOwner.data, iAmSeeker.data].filter(
    (d): d is { id: string; last_message_at: string } => !!d,
  );
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.last_message_at.localeCompare(a.last_message_at));
  return candidates[0].id;
}

/// Reach out by user pair, not by (seeker, project) pair.
///
/// If a conversation already exists between (myUserId, otherUserId) — in
/// either orientation, anchored to any project — append the message to it
/// and return that conversation id. Otherwise call the existing RPC to
/// create a new conversation tied to projectId+seekerId.
///
/// The `reused` flag lets the caller decide whether to celebrate ("Sent!")
/// or signal continuity ("Added to your chat with Noah").
export async function reachOutOrReuse(args: {
  myUserId:    string;
  otherUserId: string;
  /// Used only when creating a new conversation. Ignored if an existing
  /// one is reused (we don't reassign the chat's project_id mid-thread).
  projectId:   string;
  /// Seeker side of the new conversation. For seeker-initiated reaches
  /// this is myUserId; for owner-initiated this is otherUserId.
  seekerId:    string;
  body:        string;
}): Promise<{ conversationId: string; reused: boolean }> {
  const existing = await findExistingConversation(args.myUserId, args.otherUserId);
  if (existing) {
    await sendTextMessage({
      conversationId: existing,
      senderId:       args.myUserId,
      body:           args.body,
    });
    return { conversationId: existing, reused: true };
  }
  const fresh = await startConversationWithMessage({
    projectId: args.projectId,
    seekerId:  args.seekerId,
    body:      args.body,
  });
  return { conversationId: fresh, reused: false };
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
  /// Optional client-supplied UUID. When provided, the server uses this
  /// as the message id instead of generating one — lets the caller
  /// optimistically insert a row locally with the same id, so the
  /// realtime INSERT broadcast dedupes against the existing row instead
  /// of duplicating it.
  clientId?:      string;
}): Promise<MessageRow> {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      ...(args.clientId ? { id: args.clientId } : {}),
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
  /// Optional caption text. Schema allows body and attachment_url on the
  /// same row (check constraint is body OR attachment_url OR deleted_at),
  /// so we can send a photo + caption as one message instead of two.
  body?:          string;
  parentId?:      string | null;
  /// Same dedupe contract as sendTextMessage — see that doc.
  clientId?:      string;
}): Promise<MessageRow> {
  // Read the local file as bytes. expo-file-system would also work; using
  // fetch() keeps us dep-free here (it works for file:// URIs in RN).
  const res = await fetch(args.localUri);
  const blob = await res.blob();
  const ext = (args.localUri.match(/\.([a-zA-Z0-9]+)$/)?.[1] ?? 'jpg').toLowerCase();
  const path = `${args.conversationId}/${randomUUID()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from('chat-attachments')
    .upload(path, blob, {
      contentType: blob.type || `image/${ext}`,
      upsert: false,
    });
  if (upErr) throw upErr;

  const trimmedBody = args.body?.trim();
  const { data, error } = await supabase
    .from('messages')
    .insert({
      ...(args.clientId ? { id: args.clientId } : {}),
      conversation_id: args.conversationId,
      sender_id:       args.senderId,
      attachment_url:  path,
      body:            trimmedBody && trimmedBody.length > 0 ? trimmedBody : null,
      parent_id:       args.parentId ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as MessageRow;
}

/// Returns a short-lived signed URL for rendering an attachment in an
/// <Image>. Prefer `getCachedAttachmentUrl` from app code — that one
/// memoizes the result and avoids re-minting on every scroll.
export async function signAttachmentUrl(path: string, ttlSeconds = 3600): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('chat-attachments')
    .createSignedUrl(path, ttlSeconds);
  if (error) return null;
  return data?.signedUrl ?? null;
}

/// Process-lifetime cache for signed attachment URLs. Avoids minting a
/// fresh URL on every render/scroll — a thread with 50 image messages
/// would otherwise hit Supabase Storage 50× per remount. The cache
/// refreshes when an entry is within 60s of expiry so we never serve
/// a URL that's about to die mid-render.
///
/// Local URIs (file:// or content://) are passed through untouched —
/// used by the optimistic image path so the picked image renders
/// instantly while the real upload is in flight.
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();
const REFRESH_BUFFER_MS = 60_000;

export async function getCachedAttachmentUrl(
  path: string,
  ttlSeconds = 3600,
): Promise<string | null> {
  if (path.startsWith('file://') || path.startsWith('content://')) {
    return path;
  }
  const now = Date.now();
  const cached = signedUrlCache.get(path);
  if (cached && cached.expiresAt > now + REFRESH_BUFFER_MS) {
    return cached.url;
  }
  const url = await signAttachmentUrl(path, ttlSeconds);
  if (url) {
    signedUrlCache.set(path, { url, expiresAt: now + ttlSeconds * 1000 });
  }
  return url;
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
