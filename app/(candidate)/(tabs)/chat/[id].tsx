import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import { randomUUID } from 'expo-crypto';
import {
  ActivityIndicator,
  Animated,
  Alert,
  FlatList,
  Image,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RealtimeChannel } from '@supabase/supabase-js';
import * as Haptics from 'expo-haptics';
import { CaretDown, CaretLeft, CaretRight, DotsThree, X } from 'phosphor-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Motion } from '../../../../constants/motion';
import { Tactile, Skeleton } from '../../../../components/atoms';
import { touchPresence } from '../../../../lib/presence';
import {
  BottomSheet,
  MessageBubble,
  type MessageStatus,
  PassReasonSheet,
  TypingIndicator,
} from '../../../../components/molecules';
import {
  AvailabilityPollComposer,
  AvailabilityPollModal,
  ChatComposer,
  PartnerProfileIsland,
  SchedulingComposer,
} from '../../../../components/organisms';
import {
  confirmHire,
  proposeHire,
  type ConversationStatus,
} from '../../../../lib/closureLoop';
import { useAuth } from '../../../../context/AuthContext';
import { supabase } from '../../../../lib/supabase';
import {
  deleteMessage,
  editMessage,
  fetchProjectCard,
  fetchProjectRefs,
  listMessages,
  listReactions,
  markConversationRead,
  sendImageMessage,
  sendPortfolioAttachment,
  sendTextMessage,
  toggleReaction,
  type MessageRow,
  type ProjectRefRow,
  type ReactionRow,
} from '../../../../lib/messaging';
import { fetchPortfolioForUser, fetchPortfolioRefs } from '../../../../lib/portfolio';
import { DiscoveryCard, PortfolioModal } from '../../../../components/molecules';
import { DaySeparator, dayLabel, sameDay } from '../../../../components/molecules/DaySeparator';
import type { DiscoveryCardData, PortfolioItem } from '../../../../data/mock';
import {
  listSchedulingRequests,
  type SchedulingRequestRow,
} from '../../../../lib/scheduling';
import {
  listAvailabilityPolls,
  type AvailabilityPollRow,
} from '../../../../lib/availability';
import { AmbitFont, Brand, Radii, Space } from '../../../../constants/theme';

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
  partner_last_active_at: string | null;
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
  const insets = useSafeAreaInsets();

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
  // Projects attached to messages, keyed by id — drives the project-card
  // bubbles + the preview modal.
  const [projectRefs, setProjectRefs] = useState<Record<string, ProjectRefRow>>({});
  // Full discovery-style card shown when a project attachment is tapped.
  const [previewCard, setPreviewCard] = useState<DiscoveryCardData | null>(null);
  // Portfolio highlights referenced by portfolio_ref_id messages.
  const [portfolioRefs, setPortfolioRefs] = useState<Record<string, PortfolioItem>>({});
  // One-page highlight preview, opened by tapping a highlight bubble.
  const [previewPortfolio, setPreviewPortfolio] = useState<PortfolioItem | null>(null);
  // The + menu → "Highlight" picker: the user's own highlights to share.
  const [portfolioPickerOpen, setPortfolioPickerOpen] = useState(false);
  const [myPortfolio, setMyPortfolio] = useState<PortfolioItem[] | null>(null);
  // Messages newer than this (set at mount) animate in; history doesn't.
  const mountedAt = useRef(new Date().toISOString()).current;
  // Jump-to-newest FAB: visible when scrolled up, with an unseen-message count.
  const [scrollFabVisible, setScrollFabVisible] = useState(false);
  const [unseenCount, setUnseenCount] = useState(0);
  const fabAnim = useRef(new Animated.Value(0)).current;
  const prevLenRef = useRef(0);
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
  // True once the user drags the list — stops us from force-pinning to the
  // bottom (so we don't yank them off a message they scrolled up to read).
  const userScrolledRef = useRef(false);

  // Native-driven scroll offset for the screen-anchored bubble gradient.
  // scrollY drives the per-bubble transforms (native); scrollYRef mirrors
  // its current value on the JS thread so a bubble can capture the scroll
  // offset at the moment it measures its window position.
  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollYRef = useRef(0);
  useEffect(() => {
    const id = scrollY.addListener(({ value }) => { scrollYRef.current = value; });
    return () => scrollY.removeListener(id);
  }, [scrollY]);

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

  // Lazy-load the projects referenced by attachment messages. A ref tracks
  // which ids we've already requested so message updates don't refetch.
  const fetchedRefIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    const ids = Array.from(
      new Set(messages.map((m) => m.project_ref_id).filter(Boolean) as string[]),
    ).filter((id) => !fetchedRefIds.current.has(id));
    if (ids.length === 0) return;
    ids.forEach((id) => fetchedRefIds.current.add(id));
    let cancelled = false;
    fetchProjectRefs(ids)
      .then((map) => {
        if (cancelled || map.size === 0) return;
        setProjectRefs((prev) => {
          const next = { ...prev };
          map.forEach((v, k) => { next[k] = v; });
          return next;
        });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [messages]);

  // Same lazy-load for shared portfolio highlights.
  const fetchedPortfolioRefIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    const ids = Array.from(
      new Set(messages.map((m) => m.portfolio_ref_id).filter(Boolean) as string[]),
    ).filter((id) => !fetchedPortfolioRefIds.current.has(id));
    if (ids.length === 0) return;
    ids.forEach((id) => fetchedPortfolioRefIds.current.add(id));
    let cancelled = false;
    fetchPortfolioRefs(ids)
      .then((map) => {
        if (cancelled || map.size === 0) return;
        setPortfolioRefs((prev) => {
          const next = { ...prev };
          map.forEach((v, k) => { next[k] = v; });
          return next;
        });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [messages]);

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
        .select('name, photo_url, last_active_at')
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
        partner_last_active_at: (partnerProfile as any)?.last_active_at ?? null,
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

  // ── Open at the newest message ───────────────────────────────
  // A non-inverted FlatList virtualizes (renders ~10 rows first), so one
  // scrollToEnd lands on a stale, short content height — and bubbles/images
  // keep growing it afterward. We reset the "user scrolled" flag on open and
  // re-pin to the bottom across the settle window (also see onContentSizeChange
  // + onLayout on the list). Retries stop the moment the user drags.
  useEffect(() => {
    userScrolledRef.current = false;
    const timers = [0, 80, 250, 600].map((d) =>
      setTimeout(() => {
        if (!userScrolledRef.current) listRef.current?.scrollToEnd({ animated: false });
      }, d),
    );
    return () => timers.forEach(clearTimeout);
  }, [conversationId]);

  // New message: follow it down if parked at the bottom; otherwise bump the
  // unseen counter on the jump-to-newest FAB.
  useEffect(() => {
    const grew = messages.length > prevLenRef.current;
    prevLenRef.current = messages.length;
    if (!grew || messages.length === 0) return;
    if (userScrolledRef.current) setUnseenCount((c) => c + 1);
    else requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, [messages.length]);

  // Spring the FAB in/out on the shared motion curve.
  useEffect(() => {
    Animated.spring(fabAnim, { toValue: scrollFabVisible ? 1 : 0, ...Motion.spring, useNativeDriver: true }).start();
  }, [scrollFabVisible, fabAnim]);

  // Stamp my presence when I open this thread.
  useEffect(() => {
    if (user?.id) touchPresence(user.id);
  }, [user?.id, conversationId]);

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

  // ── Latest mine message id ───────────────────────────────────
  // Used to render the iMessage-style "Delivered" / "Read" line under
  // only the most recent outgoing bubble. All earlier mine bubbles stay
  // clean (no inline meta), which is what makes the thread feel light.
  const lastMineId = useMemo(() => {
    if (!user) return null;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].sender_id === user.id && !messages[i].deleted_at) {
        return messages[i].id;
      }
    }
    return null;
  }, [messages, user?.id]);

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

  /// Open the + menu's highlight picker, lazily loading the user's own
  /// highlights the first time.
  const openPortfolioPicker = async () => {
    if (!user) return;
    setPortfolioPickerOpen(true);
    if (myPortfolio === null) {
      const items = await fetchPortfolioForUser(user.id).catch(() => []);
      setMyPortfolio(items);
    }
  };

  /// Share one of my highlights into the thread as a structured card.
  /// Mirrors handleSendText's optimistic-then-confirm flow.
  const handleSendPortfolio = async (item: PortfolioItem) => {
    if (!user || !conversationId) return;
    setPortfolioPickerOpen(false);
    const clientId = randomUUID();
    // Make the bubble resolvable immediately (skip the ref fetch round-trip).
    setPortfolioRefs((prev) => ({ ...prev, [item.id]: item }));
    fetchedPortfolioRefIds.current.add(item.id);
    const optimistic: MessageRow = {
      id:               clientId,
      conversation_id:  conversationId,
      sender_id:        user.id,
      body:             `Shared a highlight · ${item.title}`,
      attachment_url:   null,
      portfolio_ref_id: item.id,
      parent_id:        null,
      edited_at:        null,
      deleted_at:       null,
      created_at:       new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    markPending(clientId);
    scrollToEnd();
    try {
      const real = await sendPortfolioAttachment({
        conversationId,
        senderId: user.id,
        portfolioId: item.id,
        portfolioTitle: item.title,
        clientId,
      });
      setMessages((prev) => prev.map((m) => (m.id === clientId ? real : m)));
      markSent(clientId);
    } catch {
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
    <View style={[styles.root, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {/* Hearth surface — single solid warm cream. The previous two-wash
          gradient setup made a visible "lighter cream stripe" in the
          middle where the washes faded out and the cool base canvas
          showed through. Solid warm cream reads as one unified surface. */}

      {/* Floating transparent header — iMessage parity. The overlay is
          absolutely positioned at the top of the root and is FULLY
          transparent: no blur/tint fill, so messages scroll cleanly
          behind it. Only the circular back / overflow buttons (and the
          profile island below) float over the thread. The FlatList
          compensates via paddingTop in listContent so the first message
          doesn't start under the buttons.

          Top inset is applied inline because absolute children inside
          a parent with `paddingTop` reference the parent's padding-box
          edge (y=0), not the content edge — so we have to offset by
          the safe-area inset ourselves to clear the Dynamic Island. */}
      {/* Top fade — content dissolves into the canvas as it scrolls under the
          floating back button + island, keeping the borderless top readable
          without reintroducing a blur strip. */}
      <LinearGradient
        colors={[Brand.hearthBgBase, 'rgba(255,255,255,0)']}
        style={[styles.headerScrim, { height: insets.top + 88 }]}
        pointerEvents="none"
      />

      <View pointerEvents="box-none" style={[styles.headerOverlay, { top: insets.top }]}>
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

        {/* Closure-loop status banner — sits just below the header row
            whenever the conversation isn't 'active'. Lives inside the
            transparent header overlay. */}
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
      </View>

      {/* Dynamic-Island-style name pill — absolutely positioned, morphs
          into the partner's profile card on tap. Rendered after the
          header overlay so it sits visually on top. The `top` prop
          accounts for the safe-area inset (same reason as the overlay
          above). */}
      {meta && (
        <PartnerProfileIsland
          partnerId={meta.partner_id}
          partnerName={meta.partner_name}
          partnerPhotoUrl={meta.partner_photo_url}
          partnerLastActiveAt={meta.partner_last_active_at}
          top={insets.top + 6}
          currentConversationId={meta.id}
          meUserId={user?.id}
        />
      )}

      {loading || !meta || !user ? (
        <View style={styles.skeletonBody}>
          {[
            { mine: false, w: '62%', h: 46 },
            { mine: true, w: '48%', h: 40 },
            { mine: false, w: '72%', h: 58 },
            { mine: false, w: '40%', h: 40 },
            { mine: true, w: '58%', h: 50 },
            { mine: true, w: '34%', h: 40 },
            { mine: false, w: '54%', h: 46 },
          ].map((b, i) => (
            <Skeleton
              key={i}
              width={b.w as any}
              height={b.h}
              radius={20}
              style={{ alignSelf: b.mine ? 'flex-end' : 'flex-start', marginBottom: 12 }}
            />
          ))}
        </View>
      ) : (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <Animated.FlatList
          ref={listRef as any}
          data={messages}
          keyExtractor={(m: MessageRow) => m.id}
          contentContainerStyle={[styles.listContent, { paddingTop: insets.top + 96 }]}
          scrollEventThrottle={16}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            {
              useNativeDriver: true,
              listener: (e: { nativeEvent: { contentOffset: { y: number }; contentSize: { height: number }; layoutMeasurement: { height: number } } }) => {
                const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
                const fromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
                const atBottom = fromBottom < 140;
                if (atBottom) {
                  if (scrollFabVisible) setScrollFabVisible(false);
                  if (unseenCount !== 0) setUnseenCount(0);
                  userScrolledRef.current = false; // resume auto-follow
                } else if (!scrollFabVisible) {
                  setScrollFabVisible(true);
                }
              },
            },
          )}
          // WeChat parity: scrolling or tapping the messages list closes
          // the attachment grid. onScrollBeginDrag covers any drag/scroll;
          // onTouchStart catches pure taps without claiming the gesture
          // (FlatList still owns scroll). Both are guarded by attachMenuOpen
          // so they're no-ops while the grid is closed.
          onScrollBeginDrag={() => { userScrolledRef.current = true; if (attachMenuOpen) closeAttachMenu(); }}
          onTouchStart={attachMenuOpen ? closeAttachMenu : undefined}
          // Pin to the newest message as the thread's variable-height content
          // settles on open (bubbles measure, images load) — and on new
          // messages while the user is at the bottom. Stops once they scroll.
          onContentSizeChange={() => {
            if (!userScrolledRef.current) listRef.current?.scrollToEnd({ animated: false });
          }}
          onLayout={() => {
            if (!userScrolledRef.current) listRef.current?.scrollToEnd({ animated: false });
          }}
          renderItem={({ item, index }) => {
            const parent = item.parent_id
              ? messages.find((m) => m.id === item.parent_id) ?? null
              : null;
            // Grouping: consecutive user messages from the same sender within
            // 5 min tuck together (avatar + tail only on the last of a run).
            const prevMsg = messages[index - 1];
            const nextMsg = messages[index + 1];
            const grouped = (a?: MessageRow, b?: MessageRow) =>
              !!a && !!b && (!a.kind || a.kind === 'user') && (!b.kind || b.kind === 'user') &&
              a.sender_id === b.sender_id &&
              Math.abs(new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) < 5 * 60 * 1000;
            const firstInGroup = !grouped(prevMsg, item);
            const lastInGroup = !grouped(item, nextMsg);
            const showDay = !prevMsg || !sameDay(prevMsg.created_at, item.created_at);
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
            const projRef = item.project_ref_id
              ? projectRefs[item.project_ref_id] ?? null
              : null;
            const portRef = item.portfolio_ref_id
              ? portfolioRefs[item.portfolio_ref_id] ?? null
              : null;
            return (
              <>
                {showDay && <DaySeparator label={dayLabel(item.created_at)} />}
              <MessageBubble
                message={item}
                isMine={isMine}
                animateIn={item.created_at > mountedAt}
                firstInGroup={firstInGroup}
                lastInGroup={lastInGroup}
                reactions={reactionsByMessage[item.id] ?? []}
                nameById={nameById}
                parent={parent}
                partnerLastReadAt={partnerLastReadAt}
                meId={user.id}
                status={status}
                avatarUrl={avatarUrl}
                senderName={senderName}
                isLatestMine={isMine && item.id === lastMineId}
                schedulingRequest={schedRequest}
                availabilityPoll={availPoll}
                onOpenAvailabilityPoll={setOpenPollId}
                projectRef={projRef}
                onOpenProjectRef={(ref) => {
                  // Hydrate the SAME card the discovery deck renders, then show it.
                  fetchProjectCard(ref.id)
                    .then((c) => { if (c) setPreviewCard(c); })
                    .catch(() => {});
                }}
                portfolioRef={portRef}
                onOpenPortfolioRef={setPreviewPortfolio}
                onToggleReaction={(emoji) => handleToggleReaction(item, emoji)}
                onLongPress={() => handleLongPress(item)}
                onRetry={() => handleRetry(item.id)}
                scrollY={scrollY}
                scrollYRef={scrollYRef}
              />
              </>
            );
          }}
          ListFooterComponent={partnerTyping ? (
            <TypingIndicator name={meta.partner_name.split(' ')[0]} />
          ) : null}
        />

        {/* Jump to newest — appears when scrolled up, with an unseen count. */}
        <Animated.View
          pointerEvents={scrollFabVisible ? 'auto' : 'none'}
          style={[
            styles.scrollFab,
            { bottom: insets.bottom + 76, opacity: fabAnim, transform: [{ scale: fabAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] },
          ]}
        >
          <Tactile
            haptic="tap"
            onPress={() => {
              userScrolledRef.current = false;
              setUnseenCount(0);
              setScrollFabVisible(false);
              listRef.current?.scrollToEnd({ animated: true });
            }}
            style={styles.scrollFabBtn}
            accessibilityLabel="Jump to newest messages"
          >
            <CaretDown size={18} color={Brand.inkPrimary} weight="bold" />
            {unseenCount > 0 && (
              <View style={styles.scrollFabBadge}>
                <Text style={styles.scrollFabBadgeText}>{unseenCount > 9 ? '9+' : unseenCount}</Text>
              </View>
            )}
          </Tactile>
        </Animated.View>

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
            onOpenPortfolio={openPortfolioPicker}
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
      <BottomSheet visible={overflowOpen} onClose={() => setOverflowOpen(false)}>
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
      </BottomSheet>

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
        meId={user?.id ?? ''}
        onClose={() => setOpenPollId(null)}
      />

      {/* Project preview — tapping a project-attachment bubble opens the SAME
          card the discovery deck renders, at the same size (and the 2-page
          pager for seeker cards, handled inside DiscoveryCard). */}
      <Modal
        visible={!!previewCard}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewCard(null)}
        statusBarTranslucent
      >
        <View style={styles.previewRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setPreviewCard(null)} />
          <View style={[styles.previewFrame, { paddingTop: insets.top + Space.md, paddingBottom: insets.bottom + Space.md }]}>
            {previewCard && (
              <View style={styles.previewCardArea}>
                <DiscoveryCard card={previewCard} showReachButton={false} />
              </View>
            )}
          </View>
          <Pressable
            style={[styles.previewClose, { top: insets.top + Space.md + 8 }]}
            onPress={() => setPreviewCard(null)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close project"
          >
            <X size={18} color="#FFFFFF" weight="bold" />
          </Pressable>
        </View>
      </Modal>

      {/* Highlight picker — + menu → "Highlight". Lists the user's own
          highlights to share into the thread as a card. */}
      <BottomSheet visible={portfolioPickerOpen} onClose={() => setPortfolioPickerOpen(false)}>
        <Text style={styles.pickerTitle}>Share a highlight</Text>
        {myPortfolio === null ? (
          <ActivityIndicator color={Brand.accent} style={{ marginVertical: Space.lg }} />
        ) : myPortfolio.length === 0 ? (
          <Text style={styles.pickerEmpty}>
            You don’t have any portfolio highlights yet. Add some from your profile.
          </Text>
        ) : (
          myPortfolio.map((it) => (
            <Pressable
              key={it.id}
              onPress={() => handleSendPortfolio(it)}
              style={({ pressed }) => [styles.pickerRow, pressed && { opacity: 0.7 }]}
              accessibilityRole="button"
              accessibilityLabel={`Share ${it.title}`}
            >
              {it.imageUri ? (
                <Image source={{ uri: it.imageUri }} style={styles.pickerThumb} resizeMode="cover" />
              ) : (
                <LinearGradient colors={it.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.pickerThumb} />
              )}
              <View style={styles.pickerMeta}>
                <Text style={styles.pickerRowTitle} numberOfLines={1}>{it.title}</Text>
                {!!it.timeframe && <Text style={styles.pickerRowSub} numberOfLines={1}>{it.timeframe}</Text>}
              </View>
              <CaretRight size={16} color={Brand.inkMuted} weight="bold" />
            </Pressable>
          ))
        )}
      </BottomSheet>

      {/* One-page highlight preview — read-only (no onSave/onDelete). */}
      <PortfolioModal item={previewPortfolio} onDismiss={() => setPreviewPortfolio(null)} />

      {/* Action sheet on long-press. Modal so it lives above keyboard. */}
      <BottomSheet visible={!!selectedMessage} onClose={() => setSelectedMessage(null)}>
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
      </BottomSheet>
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
  // ── Project preview modal ──────────────────────────────────────
  // Full-size project preview — mirrors the discovery deck's frame: dim
  // backdrop, Space.lg horizontal padding, card fills the area (flex:1).
  previewRoot: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  previewFrame: { flex: 1, paddingHorizontal: Space.lg },
  previewCardArea: { flex: 1, position: 'relative' },
  // ── Highlight picker (+ menu) ──────────────────────────────────────────
  pickerTitle: {
    fontFamily: AmbitFont.display,
    fontSize: 20,
    color: Brand.inkPrimary,
    marginBottom: Space.md,
  },
  pickerEmpty: {
    fontFamily: AmbitFont.body,
    fontSize: 14,
    lineHeight: 20,
    color: Brand.inkMuted,
    paddingVertical: Space.md,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  pickerThumb: {
    width: 52,
    height: 52,
    borderRadius: Radii.md,
    backgroundColor: Brand.surface2,
  },
  pickerMeta: { flex: 1, minWidth: 0 },
  pickerRowTitle: { fontFamily: AmbitFont.display, fontSize: 16, color: Brand.inkPrimary },
  pickerRowSub: { fontFamily: AmbitFont.body, fontSize: 12.5, color: Brand.inkMuted, marginTop: 2 },

  previewClose: {
    position: 'absolute',
    left: Space.lg + 4,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20,20,20,0.5)',
    zIndex: 10,
  },

  root: { flex: 1, backgroundColor: Brand.hearthBgBase },
  // Loading body — sits below the header row and fills the remaining
  // vertical space so the spinner is centered in what would otherwise
  // be the messages-list area. Keeps the header pinned at its final
  // position so there's no jump when meta resolves.
  skeletonBody: { flex: 1, paddingHorizontal: 18, paddingTop: 22 },
  loadingBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Floating transparent header — absolute-positioned wrapper that hosts
  // the headerRow and optional StatusBanner. No fill, so messages scroll
  // cleanly behind it; only the circle buttons + island read as chrome.
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 5,
  },
  // Sits above the message list, below the floating chrome (zIndex 4).
  headerScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 4,
  },
  // Jump-to-newest FAB — floats above the composer, right-aligned.
  scrollFab: { position: 'absolute', right: Space.lg, zIndex: 6 },
  scrollFabBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Brand.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Brand.borderSoft,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  scrollFabBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: Brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollFabBadgeText: { fontFamily: AmbitFont.body, fontSize: 11, fontWeight: '700', color: Brand.inkOnBrand },
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
    // Top inset clears the floating blur header AND the partner pill
    // that hangs below it (pill is 78pt tall at top:6, so bottom ≈ 84pt).
    // Extra breathing room keeps the first message off the pill's edge.
    // NOTE: paddingTop is applied inline at the call site as
    // `insets.top + 96` — the root View no longer adds a top inset, so the
    // list fills to the very top of the screen (messages scroll under the
    // Dynamic Island, iMessage-style) and the inset is folded into the
    // first message's offset here instead.
    paddingBottom: Space.md,
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
