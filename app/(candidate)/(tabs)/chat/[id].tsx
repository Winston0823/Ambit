import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import { randomUUID } from 'expo-crypto';
import {
  ActivityIndicator,
  Animated,
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
import { Image } from 'expo-image';

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
import { ArrowsClockwise, CaretDown, CaretLeft, CaretRight, Clock, DotsThree, X } from 'phosphor-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Motion } from '../../../../constants/motion';
import { GlassSurface, HardShadow, Tactile, Skeleton } from '../../../../components/atoms';
import { touchPresence } from '../../../../lib/presence';
import {
  BottomSheet,
  MessageBubble,
  type MessageStatus,
  PassReasonSheet,
  ReportReasonSheet,
  TypingIndicator,
} from '../../../../components/molecules';
import { blockUser, type ReportTarget } from '../../../../lib/safety';
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
  revertHireProposal,
  updateOwnerStage,
  getAutoCloseCountdown,
  type ConversationStatus,
  type OwnerStage,
} from '../../../../lib/closureLoop';
import { useAuth } from '../../../../context/AuthContext';
import { supabase } from '../../../../lib/supabase';
import { toast } from '../../../../lib/toast';
import { haptics } from '../../../../lib/haptics';
import {
  deleteMessage,
  editMessage,
  fetchProjectCard,
  fetchSeekerCard,
  fetchProjectRefs,
  listMessages,
  listReactions,
  markConversationRead,
  sendContactCard,
  sendImageMessage,
  sendPortfolioAttachment,
  sendTextMessage,
  toggleReaction,
  type ContactCard,
  type MessageRow,
  type ProjectRefRow,
  type ReactionRow,
} from '../../../../lib/messaging';
import { fetchPeerPhotos } from '../../../../lib/photoReveal';
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
import { AmbitFont, Astra, Brand, Radii, Space } from '../../../../constants/theme';

const QUICK_REACTIONS = ['👍', '❤️', '😂', '🙏', '🔥', '👀'];

interface ConvoMeta {
  id:                string;
  project_id:        string;
  project_title:     string;
  owner_id:          string;
  seeker_id:         string;
  partner_id:        string;
  partner_name:      string;
  partner_avatar_id: string | null;
  partner_last_active_at: string | null;
  /// Closure-loop fields used by the thread header to render the banner
  /// state (hired-pending confirm prompt, hired celebration, passed
  /// banner, auto-decline banner) and to disable the composer on
  /// terminal states.
  status:            ConversationStatus;
  pass_reason:       string | null;
  hired_at:          string | null;
  hired_proposed_by: string | null;
  /// 72h auto-decline deadline (set on conversation creation). Drives the
  /// quiet in-thread countdown banner while a reach-out awaits my reply.
  auto_decline_at:   string | null;
  /// Owner's private funnel stage (owner-only; null until first set).
  owner_stage:       OwnerStage | null;
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
  const isOwner = !!user && !!meta && meta.owner_id === user.id;

  // Who reached out first = sender of the earliest message. Queried directly
  // (not derived from the paginated `messages` list, whose first row may not be
  // the true first message). The RECEIVER of the reach-out is the one who holds
  // the hire/accept action; the reacher waits for the receiver + confirms.
  const [reacherId, setReacherId] = useState<string | null>(null);
  useEffect(() => {
    if (!conversationId) return;
    let cancelled = false;
    supabase
      .from('messages')
      .select('sender_id')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => { if (!cancelled) setReacherId((data as { sender_id: string } | null)?.sender_id ?? null); });
    return () => { cancelled = true; };
  }, [conversationId]);
  const iAmReceiver = !!reacherId && !!user && reacherId !== user.id;
  /// Signed-in user's monster mark, fetched once on screen mount and
  /// passed to MessageBubble so my own bubbles get an avatar too.
  const [myAvatarId, setMyAvatarId] = useState<string | null>(null);
  /// Revealed real photos keyed by user id — self + the partner when the
  /// thread is mutual. Refreshed when the peer's reply flips mutuality.
  const [revealed, setRevealed] = useState<Map<string, string>>(new Map());
  /// Display name of the signed-in user — used for my own bubble's
  /// accessibility label.
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
  /// True when the initial thread fetch rejected (network / server). Before
  /// this existed, ANY rejection in the initial Promise.all left `loading`
  /// stuck true forever — an infinite skeleton. Now we surface a retryable
  /// error state instead.
  const [loadError, setLoadError] = useState(false);
  /// Monotonic guard so a superseded load (conversation switch, rapid retry)
  /// can't clobber the state of the newest one.
  const loadSeqRef = useRef(0);
  /// Thread pagination. The initial fetch caps at the newest 200 messages;
  /// `hasMore` is true when that cap was hit, so a "Load earlier" header can
  /// page backwards via listMessages' `before` cursor. The ref guards against
  /// firing a second page fetch while one is already in flight.
  const [hasMore, setHasMore] = useState(false);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const loadingEarlierRef = useRef(false);

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
            | { type: 'image'; localUri: string; parentId: string | null }
            | { type: 'portfolio'; item: PortfolioItem }>
  >(new Map());

  const [partnerTyping, setPartnerTyping] = useState(false);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const listRef = useRef<FlatList<MessageRow>>(null);
  // True once the user drags the list — stops us from force-pinning to the
  // bottom (so we don't yank them off a message they scrolled up to read).
  const userScrolledRef = useRef(false);
  // True while this screen is focused — gates auto mark-read so a background
  // thread's incoming messages don't silently clear its unread state.
  const isFocusedRef = useRef(false);

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
  // Report sheet is target-driven — non-null means "report this".
  const [reportTarget, setReportTarget]   = useState<ReportTarget | null>(null);

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

  // Propose hire notifies the other party — confirm the intent on the single
  // tap before firing, so an accidental menu tap can't propose a hire.
  const handleProposeHire = () => {
    setOverflowOpen(false);
    if (!conversationId) return;
    // Only the reach-out receiver reaches this. Owner receiver = making an offer;
    // seeker receiver = accepting. Either way the other party confirms next.
    const title = isOwner ? 'Make an offer?' : 'Accept this match?';
    const body  = isOwner
      ? "They'll get your offer and confirm to make it official."
      : "They'll be asked to confirm — then you're on the team.";
    const cta   = isOwner ? 'Make offer' : 'Accept';
    Alert.alert(title, body, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: cta,
        onPress: async () => {
          try {
            await proposeHire(conversationId);
            // Optimistic: bump status locally so the banner reflects right away.
            setMeta((m) => (m ? { ...m, status: 'hired_pending', hired_proposed_by: user?.id ?? null } : m));
          } catch (e: any) {
            Alert.alert("Couldn't send that", e?.message ?? 'Try again.');
          }
        },
      },
    ]);
  };

  // Confirm hire is irreversible (terminal 'hired' state) — gate it behind a
  // confirmation so the receiving party can't close the loop on one stray tap.
  const handleConfirmHire = () => {
    if (!conversationId) return;
    Alert.alert('Confirm hire?', "This finalizes the hire and can't be undone.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm hire',
        onPress: async () => {
          try {
            await confirmHire(conversationId);
            setMeta((m) => (m ? { ...m, status: 'hired', hired_at: new Date().toISOString() } : m));
          } catch (e: any) {
            Alert.alert('Could not confirm hire', e?.message ?? 'Try again.');
          }
        },
      },
    ]);
  };

  // Revert a stuck `hired_pending` proposal back to `active`. Powers BOTH
  // the recipient's "Not yet" (decline the proposal) and the proposer's
  // "Withdraw proposal" — the server RPC just needs a participant. Not a
  // terminal/destructive action, so no blocking Alert; optimistic with a
  // rollback on failure.
  const handleRevertHire = () => {
    if (!conversationId || !meta) return;
    const prev = meta;
    haptics.selection();
    setMeta((m) => (m ? { ...m, status: 'active', hired_proposed_by: null } : m));
    revertHireProposal(conversationId).catch((e: any) => {
      setMeta(prev);
      Alert.alert('Could not update', e?.message ?? 'Try again.');
    });
  };

  const handleOpenPass = () => {
    setOverflowOpen(false);
    setPassSheetOpen(true);
  };

  // Owner's private funnel stage — optimistic local set + owner-only RPC.
  const handleSetStage = (stage: OwnerStage) => {
    if (!conversationId) return;
    setMeta((m) => (m ? { ...m, owner_stage: stage } : m));
    updateOwnerStage(conversationId, stage).catch((e: any) => {
      toast.error(e?.message ?? "Couldn't save the stage.");
    });
  };

  // Card icon → peek the partner's full discovery card (half-opaque reach).
  // Owner sees the seeker's card; the seeker sees the founder's project card.
  const handleOpenPartnerCard = async () => {
    if (!meta) return;
    const card = isOwner
      ? await fetchSeekerCard(meta.partner_id)
      : await fetchProjectCard(meta.project_id);
    if (card) setPreviewCard(card);
  };

  // ── Initial load ─────────────────────────────────────────────
  // Extracted into a stable callback so the error state's Retry can re-run
  // the exact same fetch. Any rejection now lands in catch → error state
  // (never an infinite skeleton), and `finally` always clears `loading`.
  const loadThread = useCallback(async () => {
    if (!conversationId || !user) return;
    const seq = ++loadSeqRef.current;
    const isStale = () => seq !== loadSeqRef.current;
    setLoadError(false);
    setLoading(true);

    try {
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
        .select('id, project_id, owner_id, seeker_id, status, pass_reason, hired_at, hired_proposed_by, auto_decline_at, owner_stage, projects(title)')
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
        .select('name, avatar_id, last_active_at')
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
        partner_avatar_id: (partnerProfile as any)?.avatar_id ?? null,
        partner_last_active_at: (partnerProfile as any)?.last_active_at ?? null,
        status:            ((convo as any).status as ConversationStatus) ?? 'active',
        pass_reason:       (convo as any).pass_reason ?? null,
        hired_at:          (convo as any).hired_at ?? null,
        hired_proposed_by: (convo as any).hired_proposed_by ?? null,
        auto_decline_at:   (convo as any).auto_decline_at ?? null,
        owner_stage:       ((convo as any).owner_stage as OwnerStage | null) ?? null,
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
          .select('name, avatar_id')
          .eq('id', user.id)
          .maybeSingle()
          .then(({ data }) => data),
      ]);

      if (isStale()) return;
      setMeta(partner);
      setMessages(msgs);
      // Hitting the 200 cap means there's older history to page back into.
      setHasMore(msgs.length >= 200);
      setReactions(reacts);
      setSchedulingRequests(schedReqs);
      setPolls(availPolls);
      setPartnerLastReadAt(partnerRead);
      setMyAvatarId((selfProfile as { avatar_id: string | null } | null)?.avatar_id ?? null);
      setMyName((selfProfile as { name: string | null } | null)?.name ?? 'You');
    } catch (e) {
      // A rejected fetch (network / server) must NOT hang on the skeleton
      // forever — surface a retryable error instead.
      console.warn('thread load failed:', e);
      if (!isStale()) setLoadError(true);
    } finally {
      if (!isStale()) setLoading(false);
    }
  }, [conversationId, user?.id]);

  useEffect(() => {
    loadThread();
    // Invalidate any in-flight load on unmount / conversation switch so a
    // late completion can't setState on a torn-down screen.
    return () => { loadSeqRef.current++; };
  }, [loadThread]);

  // ── Photo reveal ─────────────────────────────────────────────
  // Monster marks by default; a real photo appears only once the thread is
  // mutual (both sides have sent) — the server decides via fetch_peer_photos.
  // Self is always revealed (we pass our own id). We refetch whenever a new
  // INCOMING message lands: the peer's first reply is what flips mutuality,
  // and every incoming message flows through the realtime handler into
  // `messages`, so keying on the incoming count hooks that stream.
  const partnerId = meta?.partner_id ?? null;
  // Count ANY non-deleted message from the peer — matches the server's
  // fetch_peer_photos mutuality predicate (any non-deleted message, no kind
  // filter), so the reveal refetch fires on exactly the events that can flip it.
  const incomingCount = useMemo(
    () =>
      partnerId
        ? messages.filter((m) => m.sender_id === partnerId && !m.deleted_at).length
        : 0,
    [messages, partnerId],
  );
  useEffect(() => {
    if (!partnerId || !user) { setRevealed(new Map()); return; }
    let cancelled = false;
    fetchPeerPhotos([partnerId, user.id]).then((map) => {
      if (!cancelled) setRevealed(map);
    });
    return () => { cancelled = true; };
  }, [partnerId, user?.id, incomingCount]);

  // ── Realtime ─────────────────────────────────────────────────
  useEffect(() => {
    if (!conversationId || !user) return;

    // realtime-js dedupes channels by topic, and removeChannel() tears the
    // channel down asynchronously. A fast-refresh or a quick remount
    // (navigate away + back, notification deep-link) can therefore hand us a
    // channel that's STILL subscribed from the previous mount — and calling
    // .on() after subscribe() throws ("cannot add postgres_changes callbacks
    // after subscribe()"). So if a live channel for this topic already exists
    // we adopt it as-is (its bindings already work) and skip the wiring; only
    // a channel WE create gets bound, subscribed, and torn down here.
    const topic = `conv:${conversationId}`;
    const existing = supabase
      .getChannels()
      .find((c) => c.topic === `realtime:${topic}`);
    const ch = existing ?? supabase.channel(topic, {
      config: { presence: { key: user.id } },
    });

    if (!existing) {
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
        // '*' not 'UPDATE': the partner's FIRST read is an INSERT into
        // conversation_reads (no prior row), which an UPDATE-only listener
        // missed — so the very first ✓✓ never landed until a later update.
        event:  '*',
        schema: 'public',
        table:  'conversation_reads',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        const row = (payload.new ?? {}) as { user_id?: string; last_read_at?: string };
        if (row.user_id && row.user_id !== user.id && row.last_read_at) {
          setPartnerLastReadAt(row.last_read_at);
        }
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

    ch.subscribe((chStatus) => {
      // There's a gap between the initial fetch and the channel going live;
      // messages inserted in that window aren't broadcast to us. Once we're
      // SUBSCRIBED, reconcile against the server so nothing is dropped.
      if (chStatus === 'SUBSCRIBED') {
        listMessages(conversationId, { limit: 200 })
          .then((fresh) => {
            setMessages((prev) => {
              const byId = new Map<string, MessageRow>();
              for (const m of fresh) byId.set(m.id, m);
              // Preserve local-only optimistic rows the server doesn't have yet.
              for (const m of prev) if (!byId.has(m.id)) byId.set(m.id, m);
              return Array.from(byId.values()).sort((a, b) =>
                a.created_at.localeCompare(b.created_at),
              );
            });
          })
          .catch(() => { /* realtime will still stream new inserts */ });
      }
    });
    }
    channelRef.current = ch;

    return () => {
      // Only tear down a channel we created. removeChannel (not unsubscribe)
      // also drops it from the client's registry so a later
      // supabase.channel(`conv:${id}`) builds a fresh one instead of returning
      // this (soon-to-be-dead) instance.
      if (!existing) supabase.removeChannel(ch);
      channelRef.current = null;
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, [conversationId, user?.id]);

  // ── Mark read on focus (and on each new message arrival) ─────
  useFocusEffect(
    useCallback(() => {
      isFocusedRef.current = true;
      if (conversationId) markConversationRead(conversationId);
      return () => { isFocusedRef.current = false; };
    }, [conversationId]),
  );
  useEffect(() => {
    // Only auto mark-read when the user is actually seeing the newest
    // messages: screen focused AND parked at the bottom. A message that
    // arrives while they've scrolled up (or while the thread is backgrounded)
    // must stay unread until they come back to it.
    if (
      conversationId &&
      messages.length > 0 &&
      isFocusedRef.current &&
      !userScrolledRef.current
    ) {
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

  // ── In-thread reply deadline (72h auto-decline) ──────────────
  // A reach-out I haven't answered auto-declines 72h after the
  // conversation was created (server sweep — see 005_closure_loop). Show a
  // quiet countdown above the composer so the deadline isn't invisible.
  // Only while: status active, the partner has actually reached out, and I
  // haven't replied yet (once I send, the sweep no longer fires).
  const iHaveReplied = useMemo(
    () => !!user && messages.some((m) => m.sender_id === user.id && (!m.kind || m.kind === 'user')),
    [messages, user?.id],
  );
  const theyReachedOut = useMemo(
    () => !!meta && messages.some((m) => m.sender_id === meta.partner_id && (!m.kind || m.kind === 'user')),
    [messages, meta],
  );
  // Minute-granularity tick so the label stays live without re-rendering
  // the whole thread on every second.
  const [deadlineTick, setDeadlineTick] = useState(0);
  const deadlineActive =
    !!meta && meta.status === 'active' && !iHaveReplied && theyReachedOut && !!meta.auto_decline_at;
  useEffect(() => {
    if (!deadlineActive) return;
    const t = setInterval(() => setDeadlineTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, [deadlineActive]);
  const replyCountdown = useMemo(
    () => (deadlineActive && meta ? getAutoCloseCountdown(meta.auto_decline_at) : null),
    // deadlineTick intentionally re-reads at minute boundaries.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deadlineActive, meta?.auto_decline_at, deadlineTick],
  );

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

  /// Page one screen of older messages into the top of the thread. Uses the
  /// oldest loaded row's timestamp as the `before` cursor and prepends the
  /// result (deduped). The in-flight ref means a double-tap can't double-fetch.
  const loadEarlier = useCallback(async () => {
    if (!conversationId || loadingEarlierRef.current || !hasMore) return;
    const oldest = messages[0];
    if (!oldest) return;
    loadingEarlierRef.current = true;
    setLoadingEarlier(true);
    try {
      const older = await listMessages(conversationId, { limit: 50, before: oldest.created_at });
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        const fresh = older.filter((m) => !seen.has(m.id));
        return fresh.length > 0 ? [...fresh, ...prev] : prev;
      });
      // A short page means we've reached the start of the thread.
      setHasMore(older.length >= 50);
    } catch (e: any) {
      toast.error("Couldn't load earlier messages.");
    } finally {
      loadingEarlierRef.current = false;
      setLoadingEarlier(false);
    }
  }, [conversationId, hasMore, messages]);

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
      // Stash the payload so the bubble's "Not delivered · tap to retry"
      // affordance can re-send it (mirrors the text/image paths).
      failedPayloadsRef.current.set(clientId, { type: 'portfolio', item });
      markFailed(clientId);
    }
  };

  /// Share the current user's own contact card (name, .edu email, profile
  /// links). Snapshotted at send time; optimistic like the other attachments.
  const handleShareContact = async () => {
    if (!user || !conversationId) return;
    const { data: prof } = await supabase
      .from('profiles')
      .select('name, phone, github_url, linkedin_url, portfolio_url')
      .eq('id', user.id)
      .maybeSingle();
    const p = prof as
      | { name: string | null; phone: string | null; github_url: string | null; linkedin_url: string | null; portfolio_url: string | null }
      | null;
    const card: ContactCard = {
      name:          p?.name ?? null,
      email:         user.email ?? null,
      phone:         p?.phone ?? null,
      github_url:    p?.github_url ?? null,
      linkedin_url:  p?.linkedin_url ?? null,
      portfolio_url: p?.portfolio_url ?? null,
    };
    const clientId = randomUUID();
    const optimistic: MessageRow = {
      id:              clientId,
      conversation_id: conversationId,
      sender_id:       user.id,
      body:            'Shared contact info',
      attachment_url:  null,
      contact_card:    card,
      parent_id:       null,
      edited_at:       null,
      deleted_at:      null,
      created_at:      new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    markPending(clientId);
    scrollToEnd();
    try {
      // The server rebuilds the card authoritatively from our profile; the
      // optimistic `card` above is only the sender's instant preview.
      const real = await sendContactCard({ conversationId, clientId });
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
      } else if (payload.type === 'image') {
        const real = await sendImageMessage({
          conversationId,
          senderId: user.id,
          localUri: payload.localUri,
          parentId: payload.parentId,
          clientId: messageId,
        });
        setMessages((prev) => prev.map((m) => (m.id === messageId ? real : m)));
      } else {
        const real = await sendPortfolioAttachment({
          conversationId,
          senderId: user.id,
          portfolioId: payload.item.id,
          portfolioTitle: payload.item.title,
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
    const matches = (r: ReactionRow) =>
      r.message_id === message.id && r.user_id === user.id && r.emoji === emoji;
    const mine: ReactionRow = { message_id: message.id, user_id: user.id, emoji };
    const had = reactions.some(matches);
    // Optimistic toggle + tactile tick — the chip responds instantly instead
    // of waiting on the round trip. The realtime INSERT/DELETE that follows is
    // deduped against this local change, so it's a no-op on success.
    setReactions((prev) => (had ? prev.filter((r) => !matches(r)) : [...prev, mine]));
    haptics.selection();
    try {
      await toggleReaction({ messageId: message.id, userId: user.id, emoji });
    } catch (e: any) {
      // Roll back on failure.
      setReactions((prev) => (had ? [...prev, mine] : prev.filter((r) => !matches(r))));
      console.warn('toggle reaction failed:', e?.message);
      toast.error("Couldn't update that reaction.");
    }
  };

  const handleLongPress = (m: MessageRow) => setSelectedMessage(m);

  const handleMenuAction = async (action: 'reply' | 'copy' | 'edit' | 'delete' | 'report') => {
    const m = selectedMessage;
    setSelectedMessage(null);
    if (!m) return;
    if (action === 'reply') setReplyToAnimated(m);
    else if (action === 'copy') {
      if (m.body) await Clipboard.setStringAsync(m.body);
    } else if (action === 'edit') {
      if (m.sender_id === user?.id && m.body) setEditingAnimated(m);
    } else if (action === 'report') {
      // Report the message's author; carry the message + conversation for context.
      setReportTarget({ reportedUserId: m.sender_id, conversationId, messageId: m.id });
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

  // ── Safety: report / block the other participant ──────────────────────────
  const handleReportConversation = () => {
    setOverflowOpen(false);
    if (!meta) return;
    setReportTarget({ reportedUserId: meta.partner_id, conversationId, messageId: null });
  };

  /// Shared block action — block the partner, confirm with a toast, and leave
  /// the (now-blocked) thread. Reused by the overflow "Block user" flow and the
  /// post-report "Also block?" follow-up so both behave identically.
  const performBlock = async (name: string) => {
    if (!meta) return;
    try {
      await blockUser(meta.partner_id);
      toast.success(`Blocked ${name}.`);
      router.back();
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't block — try again.");
    }
  };

  const handleBlockUser = () => {
    setOverflowOpen(false);
    if (!meta) return;
    const name = meta.partner_name || 'this person';
    Alert.alert(
      `Block ${name}?`,
      `They won't be able to message you, and you won't see each other in the feed or inbox.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Block', style: 'destructive', onPress: () => performBlock(name) },
      ],
    );
  };

  /// After a report lands, offer the natural follow-up: block the same person.
  /// Deferred slightly so the report sheet finishes dismissing before the Alert
  /// presents (iOS can't cleanly stack an Alert over a dismissing modal).
  const handleReported = () => {
    if (!meta) return;
    const name = meta.partner_name || 'this person';
    setTimeout(() => {
      Alert.alert(
        `Also block ${name}?`,
        `Blocking stops all contact and hides you from each other in the feed and inbox.`,
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Block', style: 'destructive', onPress: () => performBlock(name) },
        ],
      );
    }, 350);
  };

  const handleQuickReact = async (emoji: string) => {
    const m = selectedMessage;
    setSelectedMessage(null);
    if (!m || !user) return;
    // Reuse the optimistic + rollback path from the reaction chip.
    await handleToggleReaction(m, emoji);
  };

  // ── Render ───────────────────────────────────────────────────
  // Same header row in both loading and loaded states so the chevron
  // + title don't visually jump when `meta` resolves. The body below
  // swaps between an ActivityIndicator and the messages list.
  const isOwnSelected = selectedMessage?.sender_id === user?.id;

  return (
    <View style={[styles.root, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {/* Real OS status bar over the light thread — dark glyphs read on the
          warm cream. (We used to hide it and draw a fake 9:41 + Dynamic Island,
          which collided with the device's real status bar and hardware island.) */}
      <StatusBar style="dark" />
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
        colors={[Brand.canvas, 'rgba(255,255,255,0)']}
        style={[styles.headerScrim, { height: insets.top + 88 }]}
        pointerEvents="none"
      />

      <View pointerEvents="box-none" style={[styles.headerOverlay, { top: insets.top }]}>
        <View style={styles.headerRow}>
          <HardShadow radius={20} offset={4}>
            <Pressable
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
                router.back();
              }}
              hitSlop={8}
              style={({ pressed }) => pressed && { opacity: 0.85 }}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <GlassSurface intensity={24} hairline style={styles.circleBtn}>
                <CaretLeft size={18} color={Brand.inkPrimary} weight="bold" />
              </GlassSurface>
            </Pressable>
          </HardShadow>

          <View style={styles.headerSpacer} />

          <HardShadow radius={20} offset={4}>
            <Pressable
              onPress={() => setOverflowOpen(true)}
              hitSlop={8}
              style={({ pressed }) => pressed && { opacity: 0.85 }}
              accessibilityRole="button"
              accessibilityLabel="More options"
            >
              <GlassSurface intensity={24} hairline style={styles.circleBtn}>
                <DotsThree size={18} color={Brand.inkPrimary} weight="bold" />
              </GlassSurface>
            </Pressable>
          </HardShadow>
        </View>

        {/* Closure-loop status banner — sits just below the header row
            whenever the conversation isn't 'active'. Lives inside the
            transparent header overlay. */}
        {meta && meta.status !== 'active' && (
          <StatusBanner
            status={meta.status}
            passReason={meta.pass_reason}
            hiredProposedBy={meta.hired_proposed_by}
            proposerIsOwner={meta.hired_proposed_by === meta.owner_id}
            partnerName={meta.partner_name}
            meId={user?.id ?? ''}
            onConfirmHire={handleConfirmHire}
            onRevertHire={handleRevertHire}
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
          partnerAvatarId={meta.partner_avatar_id}
          partnerPhotoUrl={revealed.get(meta.partner_id) ?? null}
          partnerLastActiveAt={meta.partner_last_active_at}
          top={insets.top + 6}
          currentConversationId={meta.id}
          meUserId={user?.id}
          status={meta.status}
          meetingAgreed={schedulingRequests.some((r) => r.accepted_slot != null)}
          isOwner={isOwner}
          ownerStage={meta.owner_stage}
          onSetStage={handleSetStage}
          onOpenCard={handleOpenPartnerCard}
        />
      )}

      {loadError ? (
        <ThreadError onRetry={loadThread} topPad={insets.top + 96} />
      ) : loading || !meta || !user ? (
        // Mirror the real thread: each bubble sits in a row with a 32px avatar
        // gutter (theirs left, mine right) + 8px gap, a 72% max width, and the
        // asymmetric tail corner. Same top offset as the list so bubbles don't
        // slide under the floating header.
        <View style={[styles.skeletonBody, { paddingTop: insets.top + 96 }]}>
          {[
            { mine: false, w: '62%', h: 44 },
            { mine: true, w: '48%', h: 40 },
            { mine: false, w: '70%', h: 58 },
            { mine: false, w: '40%', h: 40 },
            { mine: true, w: '58%', h: 50 },
            { mine: true, w: '34%', h: 40 },
            { mine: false, w: '54%', h: 46 },
          ].map((b, i) => (
            <View
              key={i}
              style={{
                flexDirection: 'row',
                alignItems: 'flex-end',
                gap: 8,
                marginBottom: 6,
                justifyContent: b.mine ? 'flex-end' : 'flex-start',
              }}
            >
              {!b.mine && <Skeleton width={32} height={32} radius={8} />}
              <Skeleton
                width={b.w as any}
                height={b.h}
                radius={16}
                style={{
                  borderBottomLeftRadius: b.mine ? 16 : 5,
                  borderBottomRightRadius: b.mine ? 5 : 16,
                }}
              />
              {b.mine && <Skeleton width={32} height={32} radius={8} />}
            </View>
          ))}
        </View>
      ) : (
      <KeyboardAvoidingView
        // iOS: 'padding' lifts the composer smoothly. Android: with
        // edge-to-edge (Android 15) the old adjustResize no longer moves the
        // window, so behavior={undefined} left the composer behind the
        // keyboard. 'height' shrinks the container so the bottom-anchored
        // composer rises above the keyboard.
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={0}
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
            const avatarId = isMine ? myAvatarId : meta.partner_avatar_id;
            const photoUrl = revealed.get(item.sender_id) ?? null;
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
                avatarId={avatarId}
                photoUrl={photoUrl}
                senderName={senderName}
                isLatestMine={isMine && item.id === lastMineId}
                schedulingRequest={schedRequest}
                availabilityPoll={availPoll}
                onOpenAvailabilityPoll={setOpenPollId}
                onProposeMeetingTime={() => setSchedulingOpen(true)}
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
          ListHeaderComponent={hasMore ? (
            <Pressable
              onPress={loadEarlier}
              disabled={loadingEarlier}
              style={({ pressed }) => [styles.loadEarlierRow, pressed && { opacity: 0.7 }]}
              accessibilityRole="button"
              accessibilityLabel="Load earlier messages"
            >
              {loadingEarlier ? (
                <ActivityIndicator color={Brand.accent} />
              ) : (
                <Text style={styles.loadEarlierText}>Load earlier messages</Text>
              )}
            </Pressable>
          ) : null}
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
          <HardShadow radius={22} offset={4}>
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
          </HardShadow>
        </Animated.View>

        {replyCountdown && (
          <View
            style={[
              styles.replyDeadline,
              replyCountdown.urgent && styles.replyDeadlineUrgent,
            ]}
          >
            <Clock
              size={13}
              color={replyCountdown.urgent ? Brand.danger : Brand.inkLabel}
              weight="bold"
            />
            <Text
              style={[
                styles.replyDeadlineText,
                replyCountdown.urgent && styles.replyDeadlineTextUrgent,
              ]}
            >
              Reply within {deadlinePhrase(replyCountdown.minutesLeft)} to keep this open
            </Text>
          </View>
        )}

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
            onShareContact={handleShareContact}
            onProposeHire={iAmReceiver && meta?.status === 'active' ? handleProposeHire : undefined}
            hireLabel={isOwner ? 'Make an offer' : 'Accept'}
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
                  : 'This conversation closed without a hire.'}
            </Text>
          </View>
        )}
      </KeyboardAvoidingView>
      )}

      {/* Overflow menu — hire / pass. Lives above the
          keyboard so it stays usable even with the composer focused. */}
      <BottomSheet visible={overflowOpen} onClose={() => setOverflowOpen(false)}>
        {/* Hire now lives in the composer drawer, gated to the reach-out
            receiver ("Make an offer" / "Accept"). The overflow keeps Pass +
            Report only. */}
        <Pressable
          style={styles.overflowItem}
          onPress={handleOpenPass}
          disabled={!!meta && meta.status !== 'active'}
        >
          <Text style={[styles.overflowLabel, !!meta && meta.status !== 'active' && styles.overflowLabelDisabled]}>
            Pass on this chat
          </Text>
        </Pressable>
        <Pressable style={styles.overflowItem} onPress={handleReportConversation}>
          <Text style={[styles.overflowLabel, styles.overflowLabelDanger]}>Report</Text>
        </Pressable>
        <Pressable style={styles.overflowItem} onPress={handleBlockUser}>
          <Text style={[styles.overflowLabel, styles.overflowLabelDanger]}>Block user</Text>
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
        // Save-with-overlap → continue straight into the propose step. The
        // delay lets the fullscreen poll modal finish dismissing before the
        // SchedulingComposer modal presents (iOS can't overlap the two).
        onProposeTime={() => {
          setOpenPollId(null);
          setTimeout(() => setSchedulingOpen(true), 400);
        }}
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
                {/* Half-opaque, non-interactive reach button — you're already
                    in the conversation, so reaching out again is moot. */}
                <DiscoveryCard card={previewCard} showReachButton reachDisabled />
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
            <X size={18} color={Brand.inkOnBrand} weight="bold" />
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
                <Image source={{ uri: it.imageUri }} style={styles.pickerThumb} contentFit="cover" cachePolicy="memory-disk" transition={180} />
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
        {!isOwnSelected ? (
          <MenuButton label="Report" onPress={() => handleMenuAction('report')} destructive />
        ) : null}
      </BottomSheet>

      <ReportReasonSheet
        visible={!!reportTarget}
        target={reportTarget}
        onClose={() => setReportTarget(null)}
        onReported={handleReported}
      />
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
      <Text style={[styles.menuLabel, destructive && { color: Brand.danger }]}>
        {label}
      </Text>
    </Pressable>
  );
}

/// Hours-granularity phrasing for the in-thread reply deadline banner:
/// "21h" / "2d" / "45m". Deliberately coarser than the inbox chip — the
/// banner is a gentle nudge, not a stopwatch.
function deadlinePhrase(minutesLeft: number): string {
  if (minutesLeft >= 24 * 60) {
    const days = Math.floor(minutesLeft / (24 * 60));
    return `${days}d`;
  }
  if (minutesLeft >= 60) return `${Math.floor(minutesLeft / 60)}h`;
  return `${minutesLeft}m`;
}

/// Retryable error state for a failed thread load. Mirrors the feed's
/// DeckError visual language (title + body + hard-shadow Retry) so a
/// server hiccup reads as "something to fix," not an empty thread.
function ThreadError({ onRetry, topPad }: { onRetry: () => void; topPad: number }) {
  return (
    <View style={[styles.threadErrorWrap, { paddingTop: topPad }]}>
      <Text style={styles.threadErrorTitle}>Couldn&apos;t load this conversation.</Text>
      <Text style={styles.threadErrorBody}>
        Something went wrong reaching the server. Check your connection and try again.
      </Text>
      <HardShadow radius={999} offset={4} style={styles.threadErrorCtaWrap}>
        <Pressable
          onPress={onRetry}
          style={styles.threadErrorCta}
          accessibilityRole="button"
          accessibilityLabel="Retry loading conversation"
        >
          <ArrowsClockwise size={18} color={Brand.inkOnBrand} weight="bold" />
          <Text style={styles.threadErrorCtaLabel}>Retry</Text>
        </Pressable>
      </HardShadow>
    </View>
  );
}

/// Closure-loop status banner. Sits below the header when the
/// conversation isn't 'active'. For the hire-pending state on the
/// *receiving* side, renders an inline Confirm button.
function StatusBanner({
  status,
  passReason,
  hiredProposedBy,
  proposerIsOwner,
  partnerName,
  meId,
  onConfirmHire,
  onRevertHire,
}: {
  status: ConversationStatus;
  passReason: string | null;
  hiredProposedBy: string | null;
  /// Whether the party who PROPOSED the hire is the project owner. The
  /// proposer can be either role — an owner-receiver "makes an offer", a
  /// seeker-receiver "accepts" — so the confirm/waiting copy branches on
  /// this, not on a hard-coded "hiring founder" assumption.
  proposerIsOwner: boolean;
  partnerName: string;
  meId: string;
  onConfirmHire: () => void;
  onRevertHire: () => void;
}) {
  if (status === 'hired_pending') {
    const iProposed = hiredProposedBy === meId;
    return (
      <View style={[styles.banner, styles.bannerWarm]}>
        {iProposed ? (
          <>
            <Text style={styles.bannerText}>
              {proposerIsOwner
                ? `Waiting for ${partnerName} to confirm your offer.`
                : `You accepted — waiting for ${partnerName} to confirm.`}
            </Text>
            {/* Proposer can retract a premature / mistaken proposal. */}
            <Pressable onPress={onRevertHire} style={styles.bannerGhostCta}>
              <Text style={styles.bannerGhostCtaLabel}>Withdraw</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={[styles.bannerText, styles.bannerTextEmphatic]}>
              {proposerIsOwner
                ? `${partnerName} sent you an offer. Confirm to join the team?`
                : `${partnerName} accepted your match. Confirm the hire?`}
            </Text>
            {/* Recipient can decline ("Not yet") — reverts to active so the
                thread stays usable instead of dead-ending on Confirm. */}
            <Pressable onPress={onRevertHire} style={styles.bannerGhostCta}>
              <Text style={styles.bannerGhostCtaLabel}>Not yet</Text>
            </Pressable>
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
          This conversation closed without a hire. Both sides are free to explore other matches.
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
    paddingVertical: 12,
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

  root: { flex: 1, backgroundColor: Brand.canvas },

  // "Load earlier messages" pager header — quiet tappable row at the top of
  // the thread when older history remains beyond the initial 200-message page.
  loadEarlierRow: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginBottom: 4,
  },
  loadEarlierText: {
    fontFamily: AmbitFont.semibold,
    fontSize: 13,
    color: Brand.accent,
  },

  // ── Mock iOS status bar + Dynamic Island (decorative iPhone chrome) ─────
  // ── Thread load-error state (mirrors feed DeckError) ────────────
  threadErrorWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Space.xl,
    gap: 12,
  },
  threadErrorTitle: {
    fontFamily: AmbitFont.display,
    fontSize: 22,
    color: Brand.inkPrimary,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  threadErrorBody: {
    fontFamily: AmbitFont.body,
    fontSize: 14,
    color: Brand.inkMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  threadErrorCtaWrap: { marginTop: 8 },
  threadErrorCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: Brand.action,
    borderWidth: 1.6,
    borderColor: Brand.actionInk,
  },
  threadErrorCtaLabel: {
    fontFamily: AmbitFont.bold,
    fontSize: 14,
    color: Brand.inkOnBrand,
    letterSpacing: 0.2,
  },
  // Loading body — sits below the header row and fills the remaining
  // vertical space so the spinner is centered in what would otherwise
  // be the messages-list area. Keeps the header pinned at its final
  // position so there's no jump when meta resolves.
  skeletonBody: { flex: 1, paddingHorizontal: 20, paddingTop: 24 },
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
    backgroundColor: Brand.cardCream,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Brand.inkEdge,
  },
  scrollFabBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: Brand.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollFabBadgeText: { fontFamily: AmbitFont.body, fontSize: 11, fontWeight: '700', color: Brand.inkOnBrand },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Space.md,
    paddingTop: 8,
    paddingBottom: Space.md,
  },
  // 40pt circular glass button used for back + overflow. GlassSurface
  // supplies the blur + warm-white fill + purple hairline; the HardShadow
  // wrapper lifts it softly off the thread.
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: {
    flex: 1,
  },

  // Closure-loop banner — cream island variant of the system pill
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: Space.md,
    marginVertical: 8,
    paddingHorizontal: Space.md,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Brand.inkEdge,
  },
  bannerWarm:  { backgroundColor: Brand.tagMint },
  bannerHired: { backgroundColor: Brand.accent },
  bannerMuted: { backgroundColor: Brand.cardCream },
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
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Brand.action,
    borderWidth: 1.6,
    borderColor: Brand.actionInk,
  },
  bannerCtaLabel: {
    fontFamily: AmbitFont.bold,
    fontSize: 13,
    color: Brand.inkOnBrand,
    letterSpacing: 0.2,
  },
  // Quiet secondary action on the banner (Not yet / Withdraw) — outline on
  // the warm fill so it reads as reversible, not the primary Confirm.
  bannerGhostCta: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1.4,
    borderColor: Brand.inkEdge,
    backgroundColor: 'transparent',
  },
  bannerGhostCtaLabel: {
    fontFamily: AmbitFont.body,
    fontSize: 13,
    fontWeight: '700',
    color: Brand.inkPrimary,
    letterSpacing: 0.2,
  },

  // In-thread reply deadline banner — quiet by default (sits just above
  // the composer), escalates to danger accents inside the last 24h.
  replyDeadline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: Space.md,
    marginBottom: 8,
    paddingHorizontal: Space.md,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Brand.cardCream,
    borderWidth: 1,
    borderColor: Brand.borderSoft,
    alignSelf: 'center',
  },
  replyDeadlineUrgent: {
    backgroundColor: 'rgba(192,57,43,0.08)',
    borderColor: 'rgba(192,57,43,0.35)',
  },
  replyDeadlineText: {
    fontFamily: AmbitFont.body,
    fontSize: 12.5,
    fontWeight: '600',
    color: Brand.inkLabel,
    letterSpacing: 0.1,
  },
  replyDeadlineTextUrgent: { color: Brand.danger },

  // Composer-lock placeholder shown when status is terminal
  composerLocked: {
    paddingHorizontal: Space.lg,
    paddingVertical: 16,
    marginHorizontal: Space.md,
    marginBottom: Space.md,
    backgroundColor: Brand.cardCream,
    borderRadius: Radii.card,
    borderWidth: 1.5,
    borderColor: Brand.inkEdge,
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
    marginBottom: 16,
  },
  overflowItem: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: Radii.md,
  },
  overflowLabel: {
    fontFamily: AmbitFont.body,
    fontSize: 16,
    fontWeight: '600',
    color: Brand.inkPrimary,
  },
  overflowLabelDanger: {
    color: Brand.danger,
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
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: Radii.md,
  },
  menuLabel: {
    fontFamily: AmbitFont.body,
    fontSize: 16,
    color: Brand.inkBody,
  },
});
