import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import { randomUUID } from 'expo-crypto';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  type LayoutAnimationConfig,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';

// Android needs an explicit opt-in for LayoutAnimation; iOS is on by default.
// Safe to call repeatedly — RN no-ops on subsequent calls.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/// Shared spring-ish layout transition used for the composer's
/// grid/banner show-hide flows. Roughly matches the keyboard's
/// animation duration so the grid slot feels continuous when
/// swapping between keyboard and attachment panel.
const SMOOTH_LAYOUT: LayoutAnimationConfig = {
  duration: 240,
  create: { type: 'easeInEaseOut', property: 'opacity' },
  update: { type: 'easeInEaseOut' },
  delete: { type: 'easeInEaseOut', property: 'opacity' },
};
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import type { RealtimeChannel } from '@supabase/supabase-js';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { CaretLeft, DotsThree } from 'phosphor-react-native';
import {
  MessageBubble,
  type MessageStatus,
  PassReasonSheet,
  TypingIndicator,
} from '../../../components/molecules';
import {
  AvailabilityPollComposer,
  AvailabilityPollModal,
  ChatComposer,
  PartnerProfileIsland,
  SchedulingComposer,
} from '../../../components/organisms';
import {
  confirmHire,
  proposeHire,
  type ConversationStatus,
} from '../../../lib/closureLoop';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../lib/supabase';
import {
  deleteMessage,
  editMessage,
  listMessages,
  listReactions,
  markConversationRead,
  sendImageMessage,
  sendTextMessage,
  toggleReaction,
  type MessageRow,
  type ReactionRow,
} from '../../../lib/messaging';
import {
  listSchedulingRequests,
  type SchedulingRequestRow,
} from '../../../lib/scheduling';
import {
  listAvailabilityPolls,
  type AvailabilityPollRow,
} from '../../../lib/availability';
import { AmbitFont, Brand, Radii, Space } from '../../../constants/theme';

const QUICK_REACTIONS = ['👍', '❤️', '😂', '🙏', '🔥', '👀'];

interface ConvoMeta {
  id:                string;
  project_id:        string;
  project_title:     string;
  owner_id:          string;
  seeker_id:         string;
  partner_id:        string;
  partner_name:      string;
  partner_photo_url: string | null;
  /// Closure-loop fields used by the thread header to render the banner
  /// state (hired-pending confirm prompt, hired celebration, passed
  /// banner, auto-decline banner) and to disable the composer on
  /// terminal states.
  status:            ConversationStatus;
  pass_reason:       string | null;
  hired_at:          string | null;
  hired_proposed_by: string | null;
}

/// S-051 Message Thread. Wires together:
///   - initial fetch (messages + reactions + conversation meta)
///   - realtime: postgres_changes on messages + reactions + reads
///   - typing presence via realtime broadcast
///   - mark-as-read on focus
///   - long-press action menu (react / reply / copy / edit / delete)
export default function ThreadScreen() {
  const { id: conversationId } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const [meta, setMeta] = useState<ConvoMeta | null>(null);
  /// Signed-in user's avatar URL, fetched once on screen mount and
  /// passed to MessageBubble so my own bubbles get an avatar too.
  const [myPhotoUrl, setMyPhotoUrl] = useState<string | null>(null);
  /// Display name of the signed-in user — used for the fallback initial
  /// on my own avatars when myPhotoUrl is null.
  const [myName, setMyName] = useState<string>('You');
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [reactions, setReactions] = useState<ReactionRow[]>([]);
  const [schedulingRequests, setSchedulingRequests] = useState<SchedulingRequestRow[]>([]);
  const [polls, setPolls] = useState<AvailabilityPollRow[]>([]);
  const [openPollId, setOpenPollId] = useState<string | null>(null);
  const [pollComposerOpen, setPollComposerOpen] = useState(false);
  const [partnerLastReadAt, setPartnerLastReadAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [replyTo, setReplyTo] = useState<MessageRow | null>(null);
  const [editing, setEditing] = useState<MessageRow | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<MessageRow | null>(null);
  const [schedulingOpen, setSchedulingOpen] = useState(false);
  const openPoll = useMemo(
    () => polls.find((p) => p.id === openPollId) ?? null,
    [polls, openPollId],
  );

  /// Optimistic send tracking. A message id lives in `pendingIds` while
  /// its insert is in flight, moves to `failedIds` if the request errors
  /// (the user can tap the bubble to retry), and disappears from both
  /// when the server-confirmed row replaces the optimistic one.
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());
  const [failedIds, setFailedIds] = useState<Set<string>>(() => new Set());
  /// Re-send payload keyed by client id — kept in a ref because retry
  /// doesn't need to trigger renders.
  const failedPayloadsRef = useRef<
    Map<string, { type: 'text'; body: string; parentId: string | null }
            | { type: 'image'; localUri: string; parentId: string | null }>
  >(new Map());

  const [partnerTyping, setPartnerTyping] = useState(false);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const listRef = useRef<FlatList<MessageRow>>(null);

  /// Attachment grid (WeChat-style) — state lives here so the FlatList
  /// can close it on scroll/tap. Opening dismisses the keyboard so the
  /// grid panel slots into its vacated footprint. Closing is handled by:
  ///   - the + toggle re-tapped
  ///   - the TextInput receiving focus (ChatComposer calls onCloseAttachMenu)
  ///   - the messages list being scrolled or tapped (handlers below)
  /// Wrap a state setter so the next layout pass animates smoothly.
  /// Used for reply/edit banners and other show/hide transitions where
  /// the surrounding container needs to grow or shrink with the change.
  const setAnimated = <T,>(setter: (v: T) => void) => (v: T) => {
    LayoutAnimation.configureNext(SMOOTH_LAYOUT);
    setter(v);
  };
  const setReplyToAnimated  = setAnimated(setReplyTo);
  const setEditingAnimated  = setAnimated(setEditing);

  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const openAttachMenu = () => {
    Keyboard.dismiss();
    LayoutAnimation.configureNext(SMOOTH_LAYOUT);
    setAttachMenuOpen(true);
  };
  const closeAttachMenu = () => {
    LayoutAnimation.configureNext(SMOOTH_LAYOUT);
    setAttachMenuOpen(false);
  };
  const toggleAttachMenu = () => (attachMenuOpen ? closeAttachMenu() : openAttachMenu());

  /// Closure-loop UI state: overflow menu (⋯) + pass-reason picker.
  const [overflowOpen, setOverflowOpen]   = useState(false);
  const [passSheetOpen, setPassSheetOpen] = useState(false);

  const handleProposeHire = async () => {
    setOverflowOpen(false);
    if (!conversationId) return;
    try {
      await proposeHire(conversationId);
      // Optimistic: bump status locally so the banner reflects right away.
      setMeta((m) => (m ? { ...m, status: 'hired_pending', hired_proposed_by: user?.id ?? null } : m));
    } catch (e: any) {
      Alert.alert('Could not propose hire', e?.message ?? 'Try again.');
    }
  };

  const handleConfirmHire = async () => {
    if (!conversationId) return;
    try {
      await confirmHire(conversationId);
      setMeta((m) => (m ? { ...m, status: 'hired', hired_at: new Date().toISOString() } : m));
    } catch (e: any) {
      Alert.alert('Could not confirm hire', e?.message ?? 'Try again.');
    }
  };

  const handleOpenPass = () => {
    setOverflowOpen(false);
    setPassSheetOpen(true);
  };

  // ── Initial load ─────────────────────────────────────────────
  useEffect(() => {
    if (!conversationId || !user) return;
    let cancelled = false;

    (async () => {
      // Conversation row + project title. profiles isn't directly FK'd
      // from conversations (both point at auth.users), so we fetch the
      // partner profile in a second query rather than via Postgrest join.
      //
      // Two-phase select to survive a schema where the closure-loop
      // columns (status, pass_reason, hired_at, hired_proposed_by)
      // haven't been added yet. If they're missing, Postgres errors on
      // the full select and the whole thread fails to open — which the
      // user sees as "Conversation not found" even though the row
      // exists. Fall back to baseline columns and default the missing
      // closure-loop fields locally.
      let convo: any = null;
      const full = await supabase
        .from('conversations')
        .select('id, project_id, owner_id, seeker_id, status, pass_reason, hired_at, hired_proposed_by, projects(title)')
        .eq('id', conversationId)
        .single();
      if (full.error) {
        console.warn(
          'thread fetch (full) failed, retrying baseline:',
          full.error.message,
        );
        const base = await supabase
          .from('conversations')
          .select('id, project_id, owner_id, seeker_id, projects(title)')
          .eq('id', conversationId)
          .single();
        if (base.error || !base.data) {
          Alert.alert('Conversation not found');
          router.back();
          return;
        }
        convo = base.data;
      } else {
        convo = full.data;
      }

      if (!convo) {
        Alert.alert('Conversation not found');
        router.back();
        return;
      }

      const isOwner = convo.owner_id === user.id;
      const partnerId = isOwner ? convo.seeker_id : convo.owner_id;

      const { data: partnerProfile } = await supabase
        .from('profiles')
        .select('name, photo_url')
        .eq('id', partnerId)
        .maybeSingle();

      const partner: ConvoMeta = {
        id:                convo.id,
        project_id:        convo.project_id,
        project_title:     (convo.projects as any)?.title ?? '',
        owner_id:          convo.owner_id,
        seeker_id:         convo.seeker_id,
        partner_id:        partnerId,
        partner_name:      partnerProfile?.name ?? (isOwner ? 'Seeker' : 'Owner'),
        partner_photo_url: partnerProfile?.photo_url ?? null,
        status:            ((convo as any).status as ConversationStatus) ?? 'active',
        pass_reason:       (convo as any).pass_reason ?? null,
        hired_at:          (convo as any).hired_at ?? null,
        hired_proposed_by: (convo as any).hired_proposed_by ?? null,
      };

      const [msgs, reacts, schedReqs, availPolls, partnerRead, selfProfile] = await Promise.all([
        listMessages(conversationId, { limit: 200 }),
        listReactions(conversationId),
        listSchedulingRequests(conversationId),
        listAvailabilityPolls(conversationId),
        supabase
          .from('conversation_reads')
          .select('last_read_at')
          .eq('conversation_id', conversationId)
          .eq('user_id', partner.partner_id)
          .maybeSingle()
          .then(({ data }) => data?.last_read_at ?? null),
        supabase
          .from('profiles')
          .select('name, photo_url')
          .eq('id', user.id)
          .maybeSingle()
          .then(({ data }) => data),
      ]);

      if (cancelled) return;
      setMeta(partner);
      setMessages(msgs);
      setReactions(reacts);
      setSchedulingRequests(schedReqs);
      setPolls(availPolls);
      setPartnerLastReadAt(partnerRead);
      setMyPhotoUrl((selfProfile as { photo_url: string | null } | null)?.photo_url ?? null);
      setMyName((selfProfile as { name: string | null } | null)?.name ?? 'You');
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [conversationId, user?.id]);

  // ── Realtime ─────────────────────────────────────────────────
  useEffect(() => {
    if (!conversationId || !user) return;

    const ch = supabase.channel(`conv:${conversationId}`, {
      config: { presence: { key: user.id } },
    });

    ch.on(
      'postgres_changes',
      {
        event:  '*',
        schema: 'public',
        table:  'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        if (payload.eventType === 'INSERT') {
          setMessages((prev) => {
            const row = payload.new as MessageRow;
            if (prev.some((m) => m.id === row.id)) return prev;
            return [...prev, row];
          });
        } else if (payload.eventType === 'UPDATE') {
          const row = payload.new as MessageRow;
          setMessages((prev) => prev.map((m) => (m.id === row.id ? row : m)));
        } else if (payload.eventType === 'DELETE') {
          const row = payload.old as MessageRow;
          setMessages((prev) => prev.filter((m) => m.id !== row.id));
        }
      },
    );

    ch.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'message_reactions' },
      (payload) => {
        if (payload.eventType === 'INSERT') {
          const row = payload.new as ReactionRow;
          setReactions((prev) =>
            prev.some(
              (r) =>
                r.message_id === row.message_id &&
                r.user_id === row.user_id &&
                r.emoji === row.emoji,
            )
              ? prev
              : [...prev, row],
          );
        } else if (payload.eventType === 'DELETE') {
          const row = payload.old as ReactionRow;
          setReactions((prev) =>
            prev.filter(
              (r) =>
                !(
                  r.message_id === row.message_id &&
                  r.user_id === row.user_id &&
                  r.emoji === row.emoji
                ),
            ),
          );
        }
      },
    );

    ch.on(
      'postgres_changes',
      {
        event:  'UPDATE',
        schema: 'public',
        table:  'conversation_reads',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        const row = payload.new as { user_id: string; last_read_at: string };
        if (row.user_id !== user.id) setPartnerLastReadAt(row.last_read_at);
      },
    );

    ch.on(
      'postgres_changes',
      {
        event:  '*',
        schema: 'public',
        table:  'scheduling_requests',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        if (payload.eventType === 'INSERT') {
          setSchedulingRequests((prev) => {
            const row = payload.new as SchedulingRequestRow;
            if (prev.some((r) => r.id === row.id)) return prev;
            return [...prev, row];
          });
        } else if (payload.eventType === 'UPDATE') {
          const row = payload.new as SchedulingRequestRow;
          setSchedulingRequests((prev) => prev.map((r) => (r.id === row.id ? row : r)));
        }
      },
    );

    ch.on(
      'postgres_changes',
      {
        event:  '*',
        schema: 'public',
        table:  'availability_polls',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        if (payload.eventType === 'INSERT') {
          setPolls((prev) => {
            const row = payload.new as AvailabilityPollRow;
            if (prev.some((p) => p.id === row.id)) return prev;
            return [...prev, row];
          });
        } else if (payload.eventType === 'UPDATE') {
          const row = payload.new as AvailabilityPollRow;
          setPolls((prev) => prev.map((p) => (p.id === row.id ? row : p)));
        }
      },
    );

    ch.on('broadcast', { event: 'typing' }, ({ payload }) => {
      if (payload.userId === user.id) return;
      setPartnerTyping(true);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => setPartnerTyping(false), 3000);
    });

    ch.subscribe();
    channelRef.current = ch;

    return () => {
      ch.unsubscribe();
      channelRef.current = null;
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, [conversationId, user?.id]);

  // ── Mark read on focus (and on each new message arrival) ─────
  useFocusEffect(
    useCallback(() => {
      if (conversationId) markConversationRead(conversationId);
    }, [conversationId]),
  );
  useEffect(() => {
    if (conversationId && messages.length > 0) {
      markConversationRead(conversationId);
    }
  }, [conversationId, messages.length]);

  // ── Auto-add accepted meetings to the recipient's calendar ───
  // The accepter's optimistic path (in SchedulingBubble) handles their
  // side. The proposer sees an "Add to my calendar" button in the bubble
  // and chooses to tap it — we don't auto-add on their device because
  // surprising a passive viewer with a system permission prompt is bad
  // UX. (If we wanted symmetry later, we could try silent-add when
  // permission has already been granted before.)

  // ── Auto-scroll on new message ───────────────────────────────
  useEffect(() => {
    if (messages.length === 0) return;
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  }, [messages.length]);

  // ── Name map for bubble labels ───────────────────────────────
  const nameById = useMemo<Record<string, string>>(() => {
    if (!meta || !user) return {};
    return {
      [user.id]:         'You',
      [meta.partner_id]: meta.partner_name,
    };
  }, [meta, user]);

  // ── Reactions index ──────────────────────────────────────────
  const reactionsByMessage = useMemo(() => {
    const map: Record<string, ReactionRow[]> = {};
    for (const r of reactions) (map[r.message_id] ??= []).push(r);
    return map;
  }, [reactions]);

  // ── Handlers ─────────────────────────────────────────────────

  /// Move an id between the pending / failed sets atomically. Using
  /// functional setState ensures the two updates can't tear if React
  /// schedules them across separate ticks.
  const markPending = (id: string) => {
    setPendingIds((prev) => new Set(prev).add(id));
    setFailedIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev); next.delete(id); return next;
    });
  };
  const markSent = (id: string) => {
    setPendingIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev); next.delete(id); return next;
    });
    setFailedIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev); next.delete(id); return next;
    });
    failedPayloadsRef.current.delete(id);
  };
  const markFailed = (id: string) => {
    setPendingIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev); next.delete(id); return next;
    });
    setFailedIds((prev) => new Set(prev).add(id));
  };

  /// Scroll the list to the bottom after a send. We schedule with a small
  /// timeout so the optimistic-insert setState has flushed and the FlatList
  /// has measured the new row's height — scrolling synchronously after
  /// setState frequently lands on the row above the one we just added.
  const scrollToEnd = () => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
  };

  const handleSendText = async (body: string) => {
    if (!user || !conversationId) return;
    const clientId = randomUUID();
    const parentId = replyTo?.id ?? null;

    // Optimistic insert — the bubble renders immediately with a spinner.
    const optimistic: MessageRow = {
      id:              clientId,
      conversation_id: conversationId,
      sender_id:       user.id,
      body,
      attachment_url:  null,
      parent_id:       parentId,
      edited_at:       null,
      deleted_at:      null,
      created_at:      new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    markPending(clientId);
    setReplyToAnimated(null);
    scrollToEnd();

    try {
      const real = await sendTextMessage({
        conversationId,
        senderId: user.id,
        body,
        parentId,
        clientId,
      });
      // Replace optimistic with the server-confirmed row. The realtime
      // INSERT broadcast that follows is deduped by id (same uuid both
      // sides) and becomes a no-op.
      setMessages((prev) => prev.map((m) => (m.id === clientId ? real : m)));
      markSent(clientId);
    } catch {
      failedPayloadsRef.current.set(clientId, { type: 'text', body, parentId });
      markFailed(clientId);
    }
  };

  const handleSendImage = async (localUri: string, body?: string) => {
    if (!user || !conversationId) return;
    const clientId = randomUUID();
    const parentId = replyTo?.id ?? null;
    const captionTrimmed = body?.trim() || null;

    // Optimistic insert with the LOCAL file:// URI in attachment_url.
    // MessageBubble's useAttachmentUrl detects file:// and passes it
    // through, so the picked image renders instantly. The server-confirmed
    // row will carry the real storage path and replace this row.
    const optimistic: MessageRow = {
      id:              clientId,
      conversation_id: conversationId,
      sender_id:       user.id,
      body:            captionTrimmed,
      attachment_url:  localUri,
      parent_id:       parentId,
      edited_at:       null,
      deleted_at:      null,
      created_at:      new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    markPending(clientId);
    setReplyToAnimated(null);
    scrollToEnd();

    try {
      const real = await sendImageMessage({
        conversationId,
        senderId: user.id,
        localUri,
        body: captionTrimmed ?? undefined,
        parentId,
        clientId,
      });
      setMessages((prev) => prev.map((m) => (m.id === clientId ? real : m)));
      markSent(clientId);
    } catch (e: any) {
      failedPayloadsRef.current.set(clientId, { type: 'image', localUri, parentId });
      markFailed(clientId);
      Alert.alert('Upload failed', e?.message ?? 'Tap the bubble to retry.');
    }
  };

  const handleRetry = async (messageId: string) => {
    const payload = failedPayloadsRef.current.get(messageId);
    if (!payload || !user || !conversationId) return;
    markPending(messageId);
    try {
      if (payload.type === 'text') {
        const real = await sendTextMessage({
          conversationId,
          senderId: user.id,
          body: payload.body,
          parentId: payload.parentId,
          clientId: messageId,
        });
        setMessages((prev) => prev.map((m) => (m.id === messageId ? real : m)));
      } else {
        const real = await sendImageMessage({
          conversationId,
          senderId: user.id,
          localUri: payload.localUri,
          parentId: payload.parentId,
          clientId: messageId,
        });
        setMessages((prev) => prev.map((m) => (m.id === messageId ? real : m)));
      }
      markSent(messageId);
    } catch {
      markFailed(messageId);
    }
  };

  const handleSaveEdit = async (body: string) => {
    if (!editing) return;
    await editMessage(editing.id, body);
    setEditingAnimated(null);
  };

  const handleTypingPing = () => {
    channelRef.current?.send({
      type:    'broadcast',
      event:   'typing',
      payload: { userId: user?.id },
    });
  };

  const handleToggleReaction = async (message: MessageRow, emoji: string) => {
    if (!user) return;
    try {
      await toggleReaction({ messageId: message.id, userId: user.id, emoji });
    } catch (e: any) {
      console.warn('toggle reaction failed:', e?.message);
    }
  };

  const handleLongPress = (m: MessageRow) => setSelectedMessage(m);

  const handleMenuAction = async (action: 'reply' | 'copy' | 'edit' | 'delete') => {
    const m = selectedMessage;
    setSelectedMessage(null);
    if (!m) return;
    if (action === 'reply') setReplyToAnimated(m);
    else if (action === 'copy') {
      if (m.body) await Clipboard.setStringAsync(m.body);
    } else if (action === 'edit') {
      if (m.sender_id === user?.id && m.body) setEditingAnimated(m);
    } else if (action === 'delete') {
      Alert.alert('Delete message?', 'This cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: () => deleteMessage(m.id).catch((e) =>
            Alert.alert('Delete failed', e?.message ?? '')),
        },
      ]);
    }
  };

  const handleQuickReact = async (emoji: string) => {
    const m = selectedMessage;
    setSelectedMessage(null);
    if (!m || !user) return;
    await toggleReaction({ messageId: m.id, userId: user.id, emoji });
  };

  // ── Render ───────────────────────────────────────────────────
  // Same header row in both loading and loaded states so the chevron
  // + title don't visually jump when `meta` resolves. The body below
  // swaps between an ActivityIndicator and the messages list.
  const isOwnSelected = selectedMessage?.sender_id === user?.id;

  return (
    <View style={styles.root}>
      {/* Hearth surface — two soft washes layered over the cream base
          fake a warm radial glow at the top and bottom of the screen.
          pointerEvents="none" so taps fall through to content above. */}
      <LinearGradient
        pointerEvents="none"
        colors={[Brand.hearthBgTop, 'rgba(245,239,230,0)']}
        locations={[0, 0.55]}
        style={styles.washTop}
      />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(245,239,230,0)', Brand.hearthBgBottom]}
        locations={[0.5, 1]}
        style={styles.washBottom}
      />

      {/* Header row: circular back (left) + reserved center (the floating
          PartnerProfileIsland sits over this space, absolutely
          positioned) + circular overflow ⋯ (right). The island handles
          its own animation/position; the row just sets the height
          envelope and side actions. */}
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => {
            if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
            router.back();
          }}
          hitSlop={8}
          style={({ pressed }) => [styles.circleBtn, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <CaretLeft size={18} color={Brand.inkPrimary} weight="bold" />
        </Pressable>

        <View style={styles.headerSpacer} />

        <Pressable
          onPress={() => setOverflowOpen(true)}
          hitSlop={8}
          style={({ pressed }) => [styles.circleBtn, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
          accessibilityLabel="More options"
        >
          <DotsThree size={18} color={Brand.inkPrimary} weight="bold" />
        </Pressable>
      </View>

      {/* Dynamic-Island-style name pill — absolutely positioned, morphs
          into the partner's profile card on tap. Sits above the header
          via zIndex so taps land before the row's side buttons. */}
      {meta && (
        <PartnerProfileIsland
          partnerId={meta.partner_id}
          partnerName={meta.partner_name}
          partnerPhotoUrl={meta.partner_photo_url}
          top={6}
          currentConversationId={meta.id}
          meUserId={user?.id}
        />
      )}

      {/* Closure-loop status banner — sits just below the header row
          whenever the conversation isn't 'active'. */}
      {meta && meta.status !== 'active' && (
        <StatusBanner
          status={meta.status}
          passReason={meta.pass_reason}
          hiredProposedBy={meta.hired_proposed_by}
          partnerName={meta.partner_name}
          meId={user?.id ?? ''}
          onConfirmHire={handleConfirmHire}
        />
      )}

      {loading || !meta || !user ? (
        <View style={styles.loadingBody}>
          <ActivityIndicator color={Brand.accent} />
        </View>
      ) : (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.listContent}
          // WeChat parity: scrolling or tapping the messages list closes
          // the attachment grid. onScrollBeginDrag covers any drag/scroll;
          // onTouchStart catches pure taps without claiming the gesture
          // (FlatList still owns scroll). Both are guarded by attachMenuOpen
          // so they're no-ops while the grid is closed.
          onScrollBeginDrag={attachMenuOpen ? closeAttachMenu : undefined}
          onTouchStart={attachMenuOpen ? closeAttachMenu : undefined}
          renderItem={({ item }) => {
            const parent = item.parent_id
              ? messages.find((m) => m.id === item.parent_id) ?? null
              : null;
            const status: MessageStatus =
              pendingIds.has(item.id) ? 'sending'
              : failedIds.has(item.id) ? 'failed'
              : 'sent';
            const isMine = item.sender_id === user.id;
            const avatarUrl = isMine ? myPhotoUrl : meta.partner_photo_url;
            const senderName = isMine ? myName : meta.partner_name;
            const schedRequest = item.scheduling_request_id
              ? schedulingRequests.find((r) => r.id === item.scheduling_request_id) ?? null
              : null;
            const availPoll = item.availability_poll_id
              ? polls.find((p) => p.id === item.availability_poll_id) ?? null
              : null;
            return (
              <MessageBubble
                message={item}
                isMine={isMine}
                reactions={reactionsByMessage[item.id] ?? []}
                nameById={nameById}
                parent={parent}
                partnerLastReadAt={partnerLastReadAt}
                meId={user.id}
                status={status}
                avatarUrl={avatarUrl}
                senderName={senderName}
                schedulingRequest={schedRequest}
                availabilityPoll={availPoll}
                onOpenAvailabilityPoll={setOpenPollId}
                onToggleReaction={(emoji) => handleToggleReaction(item, emoji)}
                onLongPress={() => handleLongPress(item)}
                onRetry={() => handleRetry(item.id)}
              />
            );
          }}
          ListFooterComponent={partnerTyping ? (
            <TypingIndicator name={meta.partner_name.split(' ')[0]} />
          ) : null}
        />

        {meta.status === 'active' || meta.status === 'hired_pending' ? (
          <ChatComposer
            replyTo={replyTo}
            onClearReply={() => setReplyToAnimated(null)}
            editing={editing}
            onClearEditing={() => setEditingAnimated(null)}
            nameById={nameById}
            onSendText={handleSendText}
            onSendImage={handleSendImage}
            onSaveEdit={handleSaveEdit}
            onOpenScheduling={() => setSchedulingOpen(true)}
            onOpenAvailabilityPoll={() => setPollComposerOpen(true)}
            onTypingPing={handleTypingPing}
            attachMenuOpen={attachMenuOpen}
            onToggleAttachMenu={toggleAttachMenu}
            onCloseAttachMenu={closeAttachMenu}
          />
        ) : (
          <View style={styles.composerLocked}>
            <Text style={styles.composerLockedText}>
              {meta.status === 'hired'
                ? 'This conversation has been marked as Hired.'
                : meta.status === 'passed'
                  ? 'This conversation has been passed.'
                  : 'No response — conversation auto-declined.'}
            </Text>
          </View>
        )}
      </KeyboardAvoidingView>
      )}

      {/* Overflow menu — hire / pass / block. Lives above the
          keyboard so it stays usable even with the composer focused. */}
      <Modal
        visible={overflowOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setOverflowOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setOverflowOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Pressable
              style={styles.overflowItem}
              onPress={handleProposeHire}
              disabled={!!meta && meta.status !== 'active'}
            >
              <Text style={[styles.overflowLabel, !!meta && meta.status !== 'active' && styles.overflowLabelDisabled]}>
                Mark as Hired
              </Text>
            </Pressable>
            <Pressable
              style={styles.overflowItem}
              onPress={handleOpenPass}
              disabled={!!meta && meta.status !== 'active'}
            >
              <Text style={[styles.overflowLabel, !!meta && meta.status !== 'active' && styles.overflowLabelDisabled]}>
                Pass on this chat
              </Text>
            </Pressable>
            <Pressable
              style={styles.overflowItem}
              onPress={() => {
                setOverflowOpen(false);
                Alert.alert('Block', 'Block flow coming soon.');
              }}
            >
              <Text style={[styles.overflowLabel, styles.overflowLabelDanger]}>Block</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <PassReasonSheet
        visible={passSheetOpen}
        conversationId={conversationId ?? null}
        onClose={() => setPassSheetOpen(false)}
        onPassed={(id, reason) => {
          // Optimistic: flip local meta so banner + composer-lock land instantly.
          setMeta((m) => (m ? { ...m, status: 'passed', pass_reason: reason } : m));
        }}
      />

      <SchedulingComposer
        visible={schedulingOpen}
        conversationId={conversationId ?? null}
        defaultTitle={meta ? `Chat about ${meta.project_title}` : 'Quick chat'}
        onClose={() => setSchedulingOpen(false)}
        onProposed={() => { /* realtime INSERT will append the bubble */ }}
      />

      <AvailabilityPollComposer
        visible={pollComposerOpen}
        conversationId={conversationId ?? null}
        defaultTitle={meta ? `When can we meet about ${meta.project_title}?` : 'When can we meet?'}
        onClose={() => setPollComposerOpen(false)}
        onProposed={() => { /* realtime INSERT will append the bubble */ }}
      />

      <AvailabilityPollModal
        visible={!!openPoll}
        poll={openPoll}
        meId={user.id}
        onClose={() => setOpenPollId(null)}
      />

      {/* Action sheet on long-press. Modal so it lives above keyboard. */}
      <Modal
        visible={!!selectedMessage}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedMessage(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setSelectedMessage(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.reactRow}>
              {QUICK_REACTIONS.map((e) => (
                <Pressable
                  key={e}
                  onPress={() => handleQuickReact(e)}
                  style={styles.reactBtn}
                >
                  <Text style={styles.reactEmoji}>{e}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.menuDivider} />
            <MenuButton label="Reply" onPress={() => handleMenuAction('reply')} />
            {selectedMessage?.body ? (
              <MenuButton label="Copy" onPress={() => handleMenuAction('copy')} />
            ) : null}
            {isOwnSelected && selectedMessage?.body ? (
              <MenuButton label="Edit" onPress={() => handleMenuAction('edit')} />
            ) : null}
            {isOwnSelected ? (
              <MenuButton label="Delete" onPress={() => handleMenuAction('delete')} destructive />
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function MenuButton({
  label,
  onPress,
  destructive,
}: {
  label: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [
      styles.menuBtn,
      pressed && { backgroundColor: Brand.surface2 },
    ]}>
      <Text style={[styles.menuLabel, destructive && { color: Brand.accent }]}>
        {label}
      </Text>
    </Pressable>
  );
}

/// Closure-loop status banner. Sits below the header when the
/// conversation isn't 'active'. For the hire-pending state on the
/// *receiving* side, renders an inline Confirm button.
function StatusBanner({
  status,
  passReason,
  hiredProposedBy,
  partnerName,
  meId,
  onConfirmHire,
}: {
  status: ConversationStatus;
  passReason: string | null;
  hiredProposedBy: string | null;
  partnerName: string;
  meId: string;
  onConfirmHire: () => void;
}) {
  if (status === 'hired_pending') {
    const iProposed = hiredProposedBy === meId;
    return (
      <View style={[styles.banner, styles.bannerWarm]}>
        {iProposed ? (
          <Text style={styles.bannerText}>
            Waiting for {partnerName} to confirm the hire.
          </Text>
        ) : (
          <>
            <Text style={[styles.bannerText, styles.bannerTextEmphatic]}>
              {partnerName} marked this as Hired. Confirm?
            </Text>
            <Pressable onPress={onConfirmHire} style={styles.bannerCta}>
              <Text style={styles.bannerCtaLabel}>Confirm</Text>
            </Pressable>
          </>
        )}
      </View>
    );
  }
  if (status === 'hired') {
    return (
      <View style={[styles.banner, styles.bannerHired]}>
        <Text style={[styles.bannerText, { color: Brand.inkOnBrand }]}>
          Hired — congrats.
        </Text>
      </View>
    );
  }
  if (status === 'passed') {
    return (
      <View style={[styles.banner, styles.bannerMuted]}>
        <Text style={styles.bannerText}>
          Passed{passReason ? ` — "${passReason}"` : ''}.
        </Text>
      </View>
    );
  }
  if (status === 'auto_declined') {
    return (
      <View style={[styles.banner, styles.bannerMuted]}>
        <Text style={styles.bannerText}>
          Reviewing other candidates right now.
        </Text>
      </View>
    );
  }
  return null;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.hearthBgBase },

  // Hearth washes — absolutely positioned so they sit behind everything
  // else in the screen but in front of the cream root canvas.
  washTop: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 360,
    zIndex: 0,
  },
  washBottom: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: 360,
    zIndex: 0,
  },
  // Loading body — sits below the header row and fills the remaining
  // vertical space so the spinner is centered in what would otherwise
  // be the messages-list area. Keeps the header pinned at its final
  // position so there's no jump when meta resolves.
  loadingBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Space.md,
    paddingTop: 6,
    paddingBottom: Space.md,
  },
  // 40pt circular glass button used for back + overflow. Translucent
  // white surface over the warm wash reads as floating glass — pairs
  // with the Dynamic-Island pill, the bubble shadows, and the composer.
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brand.hearthGlassBg,
    borderWidth: 1,
    borderColor: Brand.hearthGlassEdge,
    shadowColor: Brand.hearthGlassShadow,
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  headerSpacer: {
    flex: 1,
  },

  // Closure-loop banner — glass card variant of the system pill
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: Space.md,
    marginVertical: 6,
    paddingHorizontal: Space.md,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Brand.hearthGlassEdge,
  },
  bannerWarm:  { backgroundColor: 'rgba(255,243,222,0.9)' },
  bannerHired: { backgroundColor: Brand.accent },
  bannerMuted: { backgroundColor: Brand.hearthGlassBg },
  bannerText: {
    flex: 1,
    fontFamily: AmbitFont.body,
    fontSize: 13,
    color: Brand.inkBody,
    lineHeight: 18,
  },
  bannerTextEmphatic: {
    fontWeight: '600',
  },
  bannerCta: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Brand.inkPrimary,
  },
  bannerCtaLabel: {
    fontFamily: AmbitFont.body,
    fontSize: 13,
    fontWeight: '700',
    color: Brand.inkOnBrand,
    letterSpacing: 0.2,
  },

  // Composer-lock placeholder shown when status is terminal
  composerLocked: {
    paddingHorizontal: Space.lg,
    paddingVertical: 14,
    marginHorizontal: Space.md,
    marginBottom: Space.md,
    backgroundColor: Brand.hearthGlassBg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Brand.hearthGlassEdge,
    alignItems: 'center',
  },
  composerLockedText: {
    fontFamily: AmbitFont.body,
    fontSize: 13,
    color: Brand.inkMuted,
    textAlign: 'center',
  },

  // Overflow sheet — reuses the long-press sheet pattern (modalBackdrop
  // + sheet styles defined below for the reaction menu).
  sheetHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Brand.borderDefault,
    marginBottom: 14,
  },
  overflowItem: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: Radii.md,
  },
  overflowLabel: {
    fontFamily: AmbitFont.body,
    fontSize: 16,
    fontWeight: '600',
    color: Brand.inkPrimary,
  },
  overflowLabelDanger: {
    color: '#C0392B',
  },
  overflowLabelDisabled: {
    color: Brand.inkPlaceholder,
  },

  listContent: {
    paddingVertical: Space.md,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Brand.canvas,
    borderTopLeftRadius: Radii.lg,
    borderTopRightRadius: Radii.lg,
    paddingTop: 12,
    paddingBottom: 36,
    paddingHorizontal: Space.md,
  },
  reactRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
  },
  reactBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactEmoji: { fontSize: 24 },
  menuDivider: {
    height: 1,
    backgroundColor: Brand.borderDefault,
    marginVertical: 8,
  },
  menuBtn: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: Radii.md,
  },
  menuLabel: {
    fontFamily: AmbitFont.body,
    fontSize: 16,
    color: Brand.inkBody,
  },
});
