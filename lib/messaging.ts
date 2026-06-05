import { randomUUID } from 'expo-crypto';
import { File } from 'expo-file-system';
import { supabase } from './supabase';
import type { ProjectCardData } from '../data/mock';

/// Read a local file URI (file:// or content://) as an ArrayBuffer ready
/// to hand to Supabase Storage. Why not `fetch(uri).blob()`? On React
/// Native that path silently produces a 0-byte blob in many Expo SDK +
/// platform combinations — the upload "succeeds" but the file in
/// storage is empty, so the image renders as a gray rectangle later.
/// The expo-file-system v19 `File` class reads real bytes via its
/// native module, so .arrayBuffer() returns the actual file contents.
export async function readLocalFileAsArrayBuffer(uri: string): Promise<ArrayBuffer> {
  return new File(uri).arrayBuffer();
}

// ─── Types ──────────────────────────────────────────────────────────

export interface MessageRow {
  id:              string;
  conversation_id: string;
  sender_id:       string;
  body:            string | null;
  attachment_url:  string | null;
  parent_id:       string | null;
  /// When set, this message represents a scheduling action; the bubble
  /// renders the SchedulingBubble card by looking up the request by id.
  /// Added in migration 008_scheduling.
  scheduling_request_id?: string | null;
  /// When set, this message announces an availability poll; the bubble
  /// renders AvailabilityPollBubble. Added in migration 009_when2meet.
  availability_poll_id?: string | null;
  /// When set, this message carries an attached project; the bubble renders
  /// a tappable project card. Added in migration 011_message_project_ref.
  project_ref_id?: string | null;
  /// When set, this message carries a shared portfolio highlight; the bubble
  /// renders a tappable highlight card. Added in 014_message_portfolio_ref.
  portfolio_ref_id?: string | null;
  edited_at:       string | null;
  deleted_at:      string | null;
  created_at:      string;
  /// 'user' for normal participant messages; the rest are closure-loop
  /// system messages rendered as centered banners rather than speech
  /// bubbles. Server default = 'user' so legacy rows are fine.
  kind?:           'user' | 'system_pass' | 'system_hire_proposed' | 'system_hired' | 'system_auto_declined';
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
  /// Closure-loop fields. `status` drives badges + composer-disable in
  /// the thread; `hired_proposed_by` lets the receiving side know to
  /// show the Confirm banner; `auto_decline_at` is mostly informational.
  status:                      'active' | 'passed' | 'hired_pending' | 'hired' | 'auto_declined';
  pass_reason:                 string | null;
  hired_at:                    string | null;
  hired_proposed_by:           string | null;
  auto_decline_at:             string | null;
  /// Pinning — iMessage parity. Pinned conversations float above the
  /// general list (after hired_pending, before everything else). Cap
  /// is enforced server-side at 4 per user; the RPC raises
  /// `pin_limit_reached` when exceeded.
  is_pinned:                   boolean;
  pinned_at:                   string | null;
  /// Per-participant inbox state (016 + 019). Muted shows a badge; archived
  /// is hidden from the inbox client-side.
  is_muted:                    boolean;
  is_archived:                 boolean;
}

/// Pin a conversation. Throws if the caller has already pinned 4
/// conversations (server enforces the cap; we surface the message
/// to the caller verbatim).
export async function pinConversation(conversationId: string): Promise<void> {
  const { error } = await supabase.rpc('pin_conversation', {
    p_conversation_id: conversationId,
  });
  if (error) throw new Error(error.message);
}

export async function unpinConversation(conversationId: string): Promise<void> {
  const { error } = await supabase.rpc('unpin_conversation', {
    p_conversation_id: conversationId,
  });
  if (error) throw new Error(error.message);
}

/// Mute / unmute a conversation for the current user (019 RPC).
export async function setConversationMuted(conversationId: string, muted: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_conversation_muted', {
    p_conversation_id: conversationId,
    p_muted: muted,
  });
  if (error) throw new Error(error.message);
}

/// Archive / unarchive a conversation for the current user (019 RPC).
export async function setConversationArchived(conversationId: string, archived: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_conversation_archived', {
    p_conversation_id: conversationId,
    p_archived: archived,
  });
  if (error) throw new Error(error.message);
}

/// "Reached out to you" derivation. Lives client-side because it's a
/// view-state, not a stored status. True when the conversation is
/// active AND the partner sent the latest message AND the viewer has
/// never replied. Caller passes `meId` because InboxItem doesn't
/// carry it.
export function isReachedOutToYou(item: InboxItem, meId: string): boolean {
  return (
    item.status === 'active' &&
    item.last_message_sender_id !== meId &&
    item.last_message_sender_id !== null &&
    item.unread_count > 0
  );
}

/// Role-agnostic conversation state from the viewer's seat. Direction comes
/// from who sent last + unread — no schema needed. Used by the inbox filter
/// tabs AND the row chip so they always agree.
///   - your_turn : they reached out / replied — it's on you
///   - awaiting  : you sent last — waiting on them
///   - hired     : a hire is proposed or done (matters to both sides)
///   - closed    : passed / auto-declined
export type InboxState = 'your_turn' | 'awaiting' | 'hired' | 'closed';
export type InboxFilter = 'all' | 'unread' | 'your_turn' | 'hired';

export function inboxState(item: InboxItem, meId: string): InboxState {
  if (item.status === 'hired' || item.status === 'hired_pending') return 'hired';
  if (item.status === 'passed' || item.status === 'auto_declined') return 'closed';
  if (isReachedOutToYou(item, meId)) return 'your_turn';
  const theySentLast =
    item.last_message_sender_id != null && item.last_message_sender_id !== meId;
  if (theySentLast || item.unread_count > 0) return 'your_turn';
  return 'awaiting';
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

/// Minimal project row needed to render an attachment bubble + preview.
export interface ProjectRefRow {
  id:              string;
  title:           string;
  vibe_blurb:      string;
  required_skills: string[];
  owner_id:        string;
}

/// Send a message that carries an attached project. The body doubles as the
/// inbox preview caption; the bubble itself renders a tappable project card
/// (the body text is suppressed in the bubble when project_ref_id is set).
export async function sendProjectAttachment(args: {
  conversationId: string;
  senderId:       string;
  projectId:      string;
  projectTitle:   string;
  clientId?:      string;
}): Promise<MessageRow> {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      ...(args.clientId ? { id: args.clientId } : {}),
      conversation_id: args.conversationId,
      sender_id:       args.senderId,
      body:            `Shared a project · ${args.projectTitle}`,
      project_ref_id:  args.projectId,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as MessageRow;
}

/// Send a message that carries a shared portfolio highlight. The body doubles
/// as the inbox preview caption; the bubble renders a tappable highlight card
/// (body text suppressed when portfolio_ref_id is set). Mirrors
/// sendProjectAttachment.
export async function sendPortfolioAttachment(args: {
  conversationId: string;
  senderId:       string;
  portfolioId:    string;
  portfolioTitle: string;
  clientId?:      string;
}): Promise<MessageRow> {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      ...(args.clientId ? { id: args.clientId } : {}),
      conversation_id:  args.conversationId,
      sender_id:        args.senderId,
      body:             `Shared a highlight · ${args.portfolioTitle}`,
      portfolio_ref_id: args.portfolioId,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as MessageRow;
}

/// Bulk-load the projects referenced by attachment messages, keyed by id.
export async function fetchProjectRefs(ids: string[]): Promise<Map<string, ProjectRefRow>> {
  const out = new Map<string, ProjectRefRow>();
  if (ids.length === 0) return out;
  const { data } = await supabase
    .from('projects')
    .select('id, title, vibe_blurb, required_skills, owner_id')
    .in('id', ids);
  for (const r of (data ?? []) as ProjectRefRow[]) out.set(r.id, r);
  return out;
}

/// Warm-tan gradient family for project backdrops, mirroring the discovery
/// deck. Deterministic per project id so the preview matches the bubble.
const PROJECT_CARD_GRADIENTS: [string, string][] = [
  ['#D4B490', '#B48045'],
  ['#C9A57A', '#4D361D'],
  ['#E8C9A0', '#D4B490'],
  ['#B48045', '#7A5A38'],
  ['#D4B490', '#4D361D'],
];
function projectGradient(id: string): [string, string] {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PROJECT_CARD_GRADIENTS[h % PROJECT_CARD_GRADIENTS.length];
}

/// Hydrate a full discovery-style ProjectCardData for a project id — used to
/// preview a shared project as the SAME card the discovery deck renders.
/// Mirrors feed.tsx's project mapper. `select('*')` keeps it schema-tolerant.
export async function fetchProjectCard(projectId: string): Promise<ProjectCardData | null> {
  const { data } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .maybeSingle();
  if (!data) return null;
  const r = data as {
    id: string;
    title: string;
    vibe_blurb: string | null;
    required_skills: string[] | null;
    roles_sought: string[] | null;
    campus_id: string | null;
    owner_id: string;
  };
  const { data: owner } = await supabase
    .from('profiles')
    .select('name, photo_url')
    .eq('id', r.owner_id)
    .maybeSingle();
  const o = owner as { name: string | null; photo_url: string | null } | null;
  return {
    kind: 'project',
    id: r.id,
    ownerId: r.owner_id,
    title: r.title,
    pitch: r.vibe_blurb || r.title,
    ownerName: o?.name ?? 'Unknown',
    ownerPhotoUri: o?.photo_url ?? null,
    ownerCampusId: r.campus_id ?? '',
    whyMatched: '',
    skillsSought: (r.required_skills ?? []).slice(0, 5),
    rolesSought: r.roles_sought ?? [],
    gradient: projectGradient(r.id),
  };
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
  // Read the local file as an ArrayBuffer via expo-file-system. The
  // fetch().blob() route silently produces 0-byte uploads on RN; this
  // path produces real bytes. See readLocalFileAsArrayBuffer above.
  const ext = (args.localUri.match(/\.([a-zA-Z0-9]+)$/)?.[1] ?? 'jpg').toLowerCase();
  const path = `${args.conversationId}/${randomUUID()}.${ext}`;
  const bytes = await readLocalFileAsArrayBuffer(args.localUri);

  const { error: upErr } = await supabase.storage
    .from('chat-attachments')
    .upload(path, bytes, {
      contentType: `image/${ext}`,
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
