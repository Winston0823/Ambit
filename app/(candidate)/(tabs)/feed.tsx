import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowsClockwise, BookmarkSimple, CaretDown, Check, GraduationCap, MagnifyingGlass, Sparkle, X } from 'phosphor-react-native';
import type { IconProps } from 'phosphor-react-native';
import * as Haptics from 'expo-haptics';
import { DiscoveryOverview, SwipeDeck } from '../../../components/organisms';
import type { SwipeDeckHandle } from '../../../components/organisms';
import { PortfolioModal, ReachOutComposer, BottomSheet, ReachOutLimitSheet } from '../../../components/molecules';
import { HardShadow, Skeleton as SkeletonBlock, Tactile } from '../../../components/atoms';
import { CAMPUSES } from '../../../data/mock';
import {
  canReachOut,
  recordReachOut,
  getReachOutStatus,
} from '../../../lib/reachOutLimit';
import type { PortfolioItem } from '../../../data/mock';
import { useProfileRole } from '../../../hooks/useProfileRole';
import { useSavedDeck } from '../../../context/SavedDeckContext';
import {
  AmbitFont,
  Brand,
  Radii,
  Space,
} from '../../../constants/theme';
import {
  type DiscoveryCardData,
  type ProjectCardData,
  type SeekerCardData,
  MOCK_PROJECTS,
  MOCK_SEEKERS,
} from '../../../data/mock';
import { supabase } from '../../../lib/supabase';
import { sendPortfolioAttachment, sendProjectAttachment, startConversationWithMessage } from '../../../lib/messaging';
import { fetchPortfoliosByUser } from '../../../lib/portfolio';
import { useAuth } from '../../../context/AuthContext';
import { toast } from '../../../lib/toast';

const SKIP_OVERVIEW_THRESHOLD = 5;
// Stable reference so the filter BottomSheet doesn't see a new array each render.
const FILTER_SNAP_POINTS = [0.5, 0.92];

/// Mock discovery cards use non-UUID ids like 'seeker-2' / 'project-1' for
/// readability. start_conversation_with_message expects real UUIDs and
/// throws otherwise. Until the deck is fed from real Supabase rows, we
/// detect the placeholder shape and bail gracefully instead of letting the
/// RPC error bubble up.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isRealUuid = (s: string | null | undefined): s is string =>
  !!s && UUID_RE.test(s);

/// Demo decks are a DEV-ONLY affordance. In production an empty live deck
/// must render the honest empty state — mock cards look 100% real but their
/// non-UUID ids dead-end "Reach out" with a "Demo card" alert, so a new
/// user's very first action would silently fail.
const DEMO_FALLBACK = __DEV__;

const CARD_GRADIENTS: [string, string][] = [
  [Brand.primary, Brand.accent],
  ['#C9A57A', Brand.seekerInk],
  [Brand.seekerSurface, Brand.accent],
  ['#E8C9A0', Brand.primary],
  [Brand.accent, '#7A5A38'],
  [Brand.primary, Brand.seekerInk],
  [Brand.seekerSurface, Brand.accent],
];

/// Fetches ranked projects for a seeker and maps them to ProjectCardData.
/// Falls back to MOCK_PROJECTS (dev only) if the RPC fails or returns nothing.
async function fetchProjectDeck(userId: string): Promise<ProjectCardData[]> {
  const { data: ranked, error } = await supabase.rpc(
    'compat_projects_for_seeker',
    { p_seeker_id: userId, p_limit: 30 }
  );

  if (error || !ranked || ranked.length === 0) return DEMO_FALLBACK ? MOCK_PROJECTS : [];

  const rows = ranked as {
    project_id: string;
    title: string;
    vibe_blurb: string;
    required_skills: string[];
    roles_sought: string[];
    image_url: string | null;
    needed_by: string | null;
    campus_id: string | null;
    owner_id: string;
    score: number;
    skill_match_pct: number;
  }[];

  const ownerIds = [...new Set(rows.map((r) => r.owner_id))];
  const { data: owners } = await supabase
    .from('profiles')
    .select('id, name, photo_url, response_rate')
    .in('id', ownerIds);

  const ownerMap = Object.fromEntries(
    (owners ?? []).map(
      (o: { id: string; name: string; photo_url: string | null; response_rate: number | null }) => [
        o.id,
        { name: o.name, photoUri: o.photo_url, responseRate: o.response_rate },
      ]
    )
  );

  return rows.map((r, i): ProjectCardData => {
    const matchedCount = Math.round((r.skill_match_pct / 100) * r.required_skills.length);
    const whyMatched =
      matchedCount > 0
        ? `${matchedCount} matching skill${matchedCount !== 1 ? 's' : ''}`
        : 'New project near you';

    return {
      kind: 'project',
      id: r.project_id,
      ownerId: r.owner_id,
      title: r.title,
      pitch: r.vibe_blurb || r.title,
      ownerName: ownerMap[r.owner_id]?.name ?? 'Unknown',
      ownerPhotoUri: ownerMap[r.owner_id]?.photoUri ?? null,
      ownerCampusId: r.campus_id ?? '',
      whyMatched,
      skillsSought: r.required_skills.slice(0, 5),
      rolesSought: r.roles_sought ?? [],
      gradient: CARD_GRADIENTS[i % CARD_GRADIENTS.length],
      imageUri: r.image_url ?? null,
      neededBy: r.needed_by ?? null,
      // Reply-tier reflects the founder answering reach-outs, not the project.
      responseRate: ownerMap[r.owner_id]?.responseRate ?? null,
    };
  });
}

/// Fetches compatible seekers for an owner's first active project.
/// Falls back to MOCK_SEEKERS (dev only) if none found.
async function fetchSeekerDeck(userId: string): Promise<SeekerCardData[]> {
  const { data: projects } = await supabase
    .from('projects')
    .select('id')
    .eq('owner_id', userId)
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(1);

  if (!projects || projects.length === 0) return DEMO_FALLBACK ? MOCK_SEEKERS : [];

  const projectId = (projects[0] as { id: string }).id;
  const { data: ranked, error } = await supabase.rpc('compat_for_project', {
    p_project_id: projectId,
    p_limit: 30,
  });

  if (error || !ranked || ranked.length === 0) return DEMO_FALLBACK ? MOCK_SEEKERS : [];

  const rows = ranked as { seeker_id: string; score: number }[];
  const seekerIds = rows.map((r) => r.seeker_id);

  const { data: seekers } = await supabase
    .from('profiles')
    .select('id, name, photo_url, campus_id, skills, vibe_blurb, response_rate')
    .in('id', seekerIds);

  if (!seekers || seekers.length === 0) return DEMO_FALLBACK ? MOCK_SEEKERS : [];

  const scoreMap = Object.fromEntries(rows.map((r) => [r.seeker_id, r.score]));

  // Bulk-fetch portfolios for all seekers in one query → assigned per-card
  // below. Without this we'd do N+1 queries (one per seeker) or every
  // live seeker would show no portfolio bubbles even when they have them.
  const portfolioMap = await fetchPortfoliosByUser(seekerIds);

  return (seekers as {
    id: string;
    name: string;
    photo_url: string | null;
    campus_id: string | null;
    skills: string[];
    vibe_blurb: string;
    response_rate: number | null;
  }[])
    // Skip incomplete profiles — a seeker with no usable name hasn't finished
    // onboarding, and rendered a blank discovery card (`?? 'Unknown'` only
    // caught null, not the empty string these rows actually carry).
    .filter((s) => !!s.name?.trim())
    .sort((a, b) => (scoreMap[b.id] ?? 0) - (scoreMap[a.id] ?? 0))
    .map((s): SeekerCardData => ({
      kind: 'seeker',
      id: s.id,
      name: s.name.trim(),
      photoUri: s.photo_url,
      campusId: s.campus_id ?? '',
      skills: s.skills ?? [],
      vibeBlurb: s.vibe_blurb ?? '',
      portfolio: portfolioMap.get(s.id) ?? [],
      responseRate: s.response_rate ?? null,
    }));
}

/// Discovery feed (S-020) — the matching surface.
///
/// Layout:
///   ┌ wordmark + bookmark icon ─────────────────────┐
///   │                                                │
///   │            <SwipeDeck>                         │
///   │   (or)     <DiscoveryOverview>                 │
///   │   (or)     skeleton while role loads           │
///   │                                                │
///   └────────────────────────────────────────────────┘
///
/// State machine:
///   - role loading → render skeleton (blank card-shaped surface, no spinner)
///   - role known → fetch live deck; fall back to mock if empty
///   - pass → increment consecutiveSkips, push to lastFiveSeen
///   - save / message-send → reset counters
///   - consecutiveSkips reaches 5 → overlay DiscoveryOverview
export default function DiscoveryFeed() {
  const { role, loading: roleLoading } = useProfileRole();
  const { save, unsave } = useSavedDeck();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [liveDeck, setLiveDeck] = useState<DiscoveryCardData[] | null>(null);
  const [deckLoading, setDeckLoading] = useState(false);
  // Distinct from "empty": a failed load. An outage must NOT read as an empty
  // deck (theme 1/10 — "errors look like emptiness"). When true we render a
  // retry affordance instead of cards or the honest empty state.
  const [deckError, setDeckError] = useState(false);

  // Viewer's own skills — drives the matched-first ordering, the SHARED
  // tags, and the shared-count in the OverlapVenn on every card. Loaded
  // once on mount from the profiles row. Empty array on first paint /
  // for users without skills; everything still renders, just without
  // matches highlighted.
  const [viewerSkills, setViewerSkills] = useState<string[]>([]);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('skills')
        .eq('id', user.id)
        .maybeSingle();
      if (cancelled) return;
      const skills = (data as { skills: string[] | null } | null)?.skills ?? [];
      setViewerSkills(skills);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const fetchDeck = useCallback(async () => {
    if (!user || roleLoading) return;
    setDeckLoading(true);
    setDeckError(false);
    try {
      const data =
        role === 'owner'
          ? await fetchSeekerDeck(user.id)
          : await fetchProjectDeck(user.id);
      setLiveDeck(data);
    } catch (e: any) {
      // A thrown error here is a real outage (network down, query rejected) —
      // NOT an empty result. Surface it distinctly so the deck doesn't quietly
      // fall back to a misleading empty/demo state with no signal.
      console.warn('deck fetch failed:', e?.message ?? e);
      setDeckError(true);
      toast.error("Couldn't load your deck.", {
        actionLabel: 'Retry',
        onAction: () => { void fetchDeck(); },
      });
    } finally {
      setDeckLoading(false);
    }
  }, [user, role, roleLoading]);

  useEffect(() => {
    fetchDeck();
  }, [fetchDeck]);

  const deck = useMemo<DiscoveryCardData[]>(
    () =>
      liveDeck ??
      (DEMO_FALLBACK ? (role === 'owner' ? MOCK_SEEKERS : MOCK_PROJECTS) : []),
    [liveDeck, role]
  );

  // Demo cards carry non-UUID placeholder ids ('seeker-2', 'project-1') and
  // dead-end "Reach out". When the deck is the dev-only mock fallback, show a
  // visible banner so the cards don't look like real, actionable matches.
  const showingDemo = useMemo(
    () => deck.length > 0 && deck.some((c) => !isRealUuid(c.id)),
    [deck],
  );

  const [consecutiveSkips, setConsecutiveSkips] = useState(0);
  const [lastFiveSeen, setLastFiveSeen] = useState<DiscoveryCardData[]>([]);
  const [deckResetKey, setDeckResetKey] = useState(0);
  const [reinserted, setReinserted] = useState<DiscoveryCardData[]>([]);
  // Imperative handle so a confirmed reach-out can fly the current card up.
  const swipeDeckRef = useRef<SwipeDeckHandle>(null);

  /// Card whose Reach Out button was tapped. Non-null = modal composer open.
  /// SwipeDeck pauses its PanResponder via gesturesDisabled while non-null so
  /// the deck doesn't swipe out from under the composer.
  const [reachOutCard, setReachOutCard] = useState<DiscoveryCardData | null>(null);

  // Daily reach-out limit gate. When the user hits the cap, pendingCard
  // holds the card they wanted to reach out to so we can open the composer
  // right after they earn a bonus via the rewarded ad.
  const [limitSheetVisible, setLimitSheetVisible] = useState(false);
  const [limitStatus, setLimitStatus] = useState<{ used: number; limit: number }>({ used: 0, limit: 5 });
  const [pendingReachOutCard, setPendingReachOutCard] = useState<DiscoveryCardData | null>(null);

  const handleReachOutPress = async (card: DiscoveryCardData) => {
    const ok = await canReachOut();
    if (ok) {
      setReachOutCard(card);
    } else {
      const status = await getReachOutStatus();
      setLimitStatus(status);
      setPendingReachOutCard(card);
      setLimitSheetVisible(true);
    }
  };

  /// Portfolio item the user tapped to expand. Non-null = PortfolioModal
  /// visible. Pause SwipeDeck gestures while open so the deck doesn't
  /// swipe out from under the modal.
  const [activePortfolio, setActivePortfolio] = useState<PortfolioItem | null>(null);

  const activeDeck = useMemo(
    () => [...reinserted, ...deck.filter((c) => !reinserted.some((r) => r.id === c.id))],
    [reinserted, deck],
  );

  // ── Discovery filters (skills + campus) ──────────────────────
  const [filterSkills, setFilterSkills] = useState<string[]>([]);
  const [filterCampus, setFilterCampus] = useState<string[]>([]);
  const [filterSheet, setFilterSheet] = useState<null | 'skills' | 'campus'>(null);
  const [filterSearch, setFilterSearch] = useState('');
  const openFilterSheet = (dim: 'skills' | 'campus') => { setFilterSearch(''); setFilterSheet(dim); };
  const campusLabel = (id: string) => CAMPUSES.find((c) => c.id === id)?.name ?? id;

  const cardSkills = (c: DiscoveryCardData) => (c.kind === 'project' ? c.skillsSought : c.skills) ?? [];
  const cardCampus = (c: DiscoveryCardData) => (c.kind === 'project' ? c.ownerCampusId : c.campusId) ?? '';

  const filteredDeck = useMemo(
    () =>
      activeDeck.filter((c) => {
        const sk = cardSkills(c).map((s) => s.toLowerCase());
        const skillOk = filterSkills.length === 0 || filterSkills.some((f) => sk.includes(f.toLowerCase()));
        const campusOk = filterCampus.length === 0 || filterCampus.includes(cardCampus(c));
        return skillOk && campusOk;
      }),
    [activeDeck, filterSkills, filterCampus],
  );

  const skillOptions = useMemo(
    () => Array.from(new Set(activeDeck.flatMap(cardSkills))).sort((a, b) => a.localeCompare(b)),
    [activeDeck],
  );

  const toggleFilter = (dim: 'skills' | 'campus', value: string) => {
    const [list, set] = dim === 'skills' ? [filterSkills, setFilterSkills] as const : [filterCampus, setFilterCampus] as const;
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  };
  const filterCount = filterSkills.length + filterCampus.length;

  // Options for the open sheet, narrowed by the search box.
  const sheetOptions = useMemo(() => {
    const all = filterSheet === 'campus' ? CAMPUSES.map((c) => c.id) : skillOptions;
    const q = filterSearch.trim().toLowerCase();
    if (!q) return all;
    return all.filter((opt) => (filterSheet === 'campus' ? campusLabel(opt) : opt).toLowerCase().includes(q));
  }, [filterSheet, filterSearch, skillOptions]);

  const overviewVisible = consecutiveSkips >= SKIP_OVERVIEW_THRESHOLD;

  const handlePass = (card: DiscoveryCardData) => {
    setConsecutiveSkips((n) => n + 1);
    setLastFiveSeen((prev) => {
      const next = [...prev, card];
      return next.length > SKIP_OVERVIEW_THRESHOLD
        ? next.slice(next.length - SKIP_OVERVIEW_THRESHOLD)
        : next;
    });
    // Record skip in matches table for project cards
    if (card.kind === 'project' && user) {
      supabase.from('matches').upsert(
        { seeker_id: user.id, project_id: card.id, outcome: 'skipped' },
        { onConflict: 'seeker_id,project_id' }
      ).then(() => {});
    }
  };

  const handleSave = (card: DiscoveryCardData) => {
    save(card);
    setConsecutiveSkips(0);
    setLastFiveSeen([]);
    if (card.kind === 'project' && user) {
      supabase.from('matches').upsert(
        { seeker_id: user.id, project_id: card.id, outcome: 'saved' },
        { onConflict: 'seeker_id,project_id' }
      ).then(() => {});
    }
  };

  /// Undo the last pass/save from the deck's rewind button. Reverses the
  /// side-effects: clears the match row, un-saves, and (for a pass) rolls
  /// back the skip counter so the recovery overlay logic stays consistent.
  const handleRewind = (card: DiscoveryCardData, action: 'pass' | 'save') => {
    if (action === 'pass') {
      setConsecutiveSkips((n) => Math.max(0, n - 1));
      setLastFiveSeen((prev) => prev.slice(0, -1));
    } else {
      unsave(card.id);
    }
    if (card.kind === 'project' && user) {
      supabase
        .from('matches')
        .delete()
        .eq('seeker_id', user.id)
        .eq('project_id', card.id)
        .then(() => {});
    }
  };

  /// Composer-send (swipe-up "Say hi" on a discovery card). Creates or
  /// finds the conversation and posts the first message. Does NOT navigate
  /// into the thread — the user stays in the discovery deck and the new
  /// conversation surfaces in the Chat tab via the inbox's realtime
  /// subscription. Also records the match outcome as 'applied' so the
  /// project doesn't reappear in future decks. Seeker-side: project_id =
  /// card.id, seeker = me. Owner-side: project_id = my first active
  /// project, seeker = card.id.
  /// Composer-send. Performs the conversation create + first message and
  /// returns true/false; the ReachOutComposer awaits this and only shows
  /// its "on its way" affirmation on success (failure reverses with an
  /// inline error). Dismissal + skip-counter reset happen in handleReachSent
  /// (success only). Stays in the deck — the new conversation surfaces in
  /// the Chat tab via the inbox's realtime subscription.
  const handleMessage = async (
    card: DiscoveryCardData,
    text: string,
    attachment?: { id: string; title: string } | null,
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      let projectId: string;
      let seekerId:  string;

      if (card.kind === 'project') {
        // Placeholder mock cards have ids like 'project-1'. Skip messaging
        // until the deck is wired to real Supabase project rows.
        if (!isRealUuid(card.id) || !isRealUuid(card.ownerId)) {
          Alert.alert(
            'Demo card',
            "This is a placeholder card — messaging isn't wired for it yet.",
          );
          return false;
        }
        projectId = card.id;
        seekerId  = user.id;
        // Mirror the existing match-outcome write so the project gets
        // filtered out of future decks.
        supabase
          .from('matches')
          .upsert(
            { seeker_id: user.id, project_id: card.id, outcome: 'applied' },
            { onConflict: 'seeker_id,project_id' },
          )
          .then(() => {});
      } else {
        // Placeholder seeker cards (id like 'seeker-2') aren't real users.
        if (!isRealUuid(card.id)) {
          Alert.alert(
            'Demo card',
            "This is a placeholder card — messaging isn't wired for it yet.",
          );
          return false;
        }
        // Owner messaging a seeker card. Look up the owner's first active
        // project as the conversation context.
        const { data: proj } = await supabase
          .from('projects')
          .select('id')
          .eq('owner_id', user.id)
          .eq('active', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!proj) {
          Alert.alert(
            'No active project',
            'Create a project before reaching out to seekers.',
          );
          return false;
        }
        projectId = (proj as { id: string }).id;
        seekerId  = card.id;
      }

      // Per-project semantics: each reach-out about a different project
      // becomes its own thread. The DB-side ON CONFLICT in
      // start_conversation_with_message means re-reaching about the same
      // project appends to the existing thread, which is correct dedup.
      const conversationId = await startConversationWithMessage({
        projectId,
        seekerId,
        body: text,
      });
      if (attachment) {
        // Reaching out to a seeker attaches a PROJECT; to a project attaches a
        // PORTFOLIO highlight. (card.kind drives which.)
        const send = card.kind === 'seeker'
          ? sendProjectAttachment({ conversationId, senderId: user.id, projectId: attachment.id, projectTitle: attachment.title })
          : sendPortfolioAttachment({ conversationId, senderId: user.id, portfolioId: attachment.id, portfolioTitle: attachment.title });
        await send.catch((e: any) => console.warn('attachment send failed:', e?.message ?? e));
      }
      return true;
    } catch (e: any) {
      console.warn('reach out failed:', e?.message ?? e);
      return false;
    }
  };

  /// Called by the composer after a confirmed send. Resets the skip counters,
  /// closes the composer, and flies the messaged card up off the deck —
  /// reaching out is the third terminal exit (up = sent), so you advance to the
  /// next card and can't pass/save the same person you just messaged. No-op if
  /// the reach came from a context where the deck isn't mounted (e.g. overview).
  const handleReachSent = () => {
    const reached = reachOutCard;
    setConsecutiveSkips(0);
    setLastFiveSeen([]);
    setReachOutCard(null);
    if (reached) swipeDeckRef.current?.commitReach(reached.id);
  };

  const handleOverviewPick = (card: DiscoveryCardData) => {
    setReinserted((prev) => [card, ...prev.filter((c) => c.id !== card.id)]);
    setConsecutiveSkips(0);
    setLastFiveSeen([]);
    setDeckResetKey((k) => k + 1);
  };

  const handleOverviewContinue = () => {
    setConsecutiveSkips(0);
    setLastFiveSeen([]);
  };

  /// Restart the deck. Clears skipped matches in the DB so the RPC
  /// surfaces them again, drops local skip/overview state, and bumps
  /// deckResetKey so the SwipeDeck remounts at index 0. We keep
  /// 'applied' rows (those started conversations — don't re-show) and
  /// 'saved' rows (the user explicitly bookmarked them in another tab).
  const handleRefresh = useCallback(async () => {
    if (!user) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    await supabase
      .from('matches')
      .delete()
      .eq('seeker_id', user.id)
      .eq('outcome', 'skipped');
    setReinserted([]);
    setConsecutiveSkips(0);
    setLastFiveSeen([]);
    setDeckResetKey((k) => k + 1);
    await fetchDeck();
  }, [user, fetchDeck]);

  const goToSaved = () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    router.push('/saved');
  };

  const loading = roleLoading || deckLoading;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable
          onPress={handleRefresh}
          hitSlop={12}
          style={styles.refreshBtn}
          accessibilityRole="button"
          accessibilityLabel="Refresh deck"
        >
          <ArrowsClockwise size={22} color={Brand.inkPrimary} weight="regular" />
        </Pressable>
        <Text style={styles.wordmark}>ambit</Text>
        <Pressable
          onPress={goToSaved}
          hitSlop={12}
          style={styles.bookmarkBtn}
          accessibilityRole="button"
          accessibilityLabel="Open saved list"
        >
          <BookmarkSimple size={22} color={Brand.inkPrimary} weight="regular" />
        </Pressable>
      </View>

      {/* Filter row — short rectangle buttons above the card. */}
      {!loading && !overviewVisible && (
        <View style={styles.filterRow}>
          <FilterButton Icon={Sparkle} label="Skills" count={filterSkills.length} onPress={() => openFilterSheet('skills')} />
          <FilterButton Icon={GraduationCap} label="Campus" count={filterCampus.length} onPress={() => openFilterSheet('campus')} />
          {filterCount > 0 && (
            <Tactile haptic="tap" onPress={() => { setFilterSkills([]); setFilterCampus([]); }} style={styles.filterClear} accessibilityLabel="Clear filters">
              <Text style={styles.filterClearText}>Clear</Text>
            </Tactile>
          )}
        </View>
      )}

      {/* Demo banner — only when the dev-only mock fallback is showing, so the
          placeholder cards (which dead-end "Reach out") read as demo data, not
          real matches. */}
      {!loading && !overviewVisible && !deckError && showingDemo && (
        <View style={styles.demoBanner}>
          <Sparkle size={13} color={Brand.actionDeep} weight="fill" />
          <Text style={styles.demoBannerText}>Demo cards — sample data, not live matches</Text>
        </View>
      )}

      {loading ? (
        <Skeleton />
      ) : deckError && !liveDeck ? (
        <DeckError onRetry={fetchDeck} />
      ) : overviewVisible ? (
        <DiscoveryOverview
          seen={lastFiveSeen}
          onPick={handleOverviewPick}
          onContinue={handleOverviewContinue}
        />
      ) : (
        <SwipeDeck
          ref={swipeDeckRef}
          key={`${deckResetKey}-${filterSkills.join(',')}-${filterCampus.join(',')}`}
          deck={filteredDeck}
          matchedSkills={viewerSkills}
          onPass={handlePass}
          onSave={handleSave}
          onRewind={handleRewind}
          onReachOut={handleReachOutPress}
          onPortfolioPress={setActivePortfolio}
          activePortfolioId={activePortfolio?.id ?? null}
          gesturesDisabled={!!reachOutCard || !!activePortfolio}
          emptyState={<DeckExhausted onRefresh={handleRefresh} isOwner={role === 'owner'} neverHadCards={activeDeck.length === 0} />}
        />
      )}

      {/* Reach Out composer — opens when the user taps the pinned footer
          button on a card. Sending fires handleMessage which creates (or
          finds) the conversation and resets the skip counter. */}
      <ReachOutComposer
        card={reachOutCard}
        onDismiss={() => setReachOutCard(null)}
        onSend={async (card, text, attachment) => {
          const ok = await handleMessage(card, text, attachment);
          if (ok) recordReachOut().catch(() => {});
          return ok;
        }}
        onSent={handleReachSent}
      />

      {/* Portfolio detail — opens when the user taps the "Currently
          shipping" preview tile on a card. View-mode only (no onSave /
          onDelete), so the modal just surfaces the description and
          dismisses on scrim tap. */}
      <PortfolioModal
        item={activePortfolio}
        onDismiss={() => setActivePortfolio(null)}
      />

      {/* Filter sheet — searchable + drag-to-expand (half → near-top). */}
      <BottomSheet visible={filterSheet !== null} onClose={() => setFilterSheet(null)} snapPoints={FILTER_SNAP_POINTS}>
        <View style={styles.filterSheetHead}>
          <Text style={styles.filterSheetTitle}>
            {filterSheet === 'campus' ? 'Campus' : 'Skills'}
          </Text>
          {filterCount > 0 && (
            <Tactile haptic="tap" onPress={() => { setFilterSkills([]); setFilterCampus([]); }} style={styles.filterSheetClear} accessibilityLabel="Clear all filters">
              <Text style={styles.filterSheetClearText}>Clear all</Text>
            </Tactile>
          )}
        </View>

        <View style={styles.filterSearchBar}>
          <MagnifyingGlass size={16} color={Brand.inkMuted} weight="bold" />
          <TextInput
            value={filterSearch}
            onChangeText={setFilterSearch}
            placeholder={filterSheet === 'campus' ? 'Search campuses' : 'Search skills'}
            placeholderTextColor={Brand.inkPlaceholder}
            style={styles.filterSearchInput}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {filterSearch !== '' && (
            <Pressable onPress={() => setFilterSearch('')} hitSlop={8} accessibilityLabel="Clear search">
              <X size={14} color={Brand.inkMuted} weight="bold" />
            </Pressable>
          )}
        </View>

        <ScrollView
          style={styles.filterScroll}
          contentContainerStyle={styles.filterSheetChips}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {sheetOptions.map((opt) => {
            const selected = (filterSheet === 'campus' ? filterCampus : filterSkills).includes(opt);
            const label = filterSheet === 'campus' ? campusLabel(opt) : opt;
            return (
              <Tactile
                key={opt}
                haptic="selection"
                onPress={() => toggleFilter(filterSheet === 'campus' ? 'campus' : 'skills', opt)}
                style={[styles.filterSheetChip, selected && styles.filterSheetChipSel]}
                accessibilityLabel={label}
              >
                {selected && <Check size={13} color={Brand.inkOnBrand} weight="bold" />}
                <Text style={[styles.filterSheetChipText, selected && styles.filterSheetChipTextSel]}>{label}</Text>
              </Tactile>
            );
          })}
          {sheetOptions.length === 0 && (
            <Text style={styles.filterSheetEmpty}>{filterSearch ? 'No matches.' : 'Nothing to filter on yet.'}</Text>
          )}
        </ScrollView>
      </BottomSheet>

      <ReachOutLimitSheet
        visible={limitSheetVisible}
        used={limitStatus.used}
        limit={limitStatus.limit}
        onDismiss={() => {
          setLimitSheetVisible(false);
          setPendingReachOutCard(null);
        }}
        onAdComplete={() => {
          setLimitSheetVisible(false);
          // Open the composer with the card they originally wanted to reach out to.
          if (pendingReachOutCard) setReachOutCard(pendingReachOutCard);
          setPendingReachOutCard(null);
        }}
      />
    </View>
  );
}

/// Borderless icon + label filter trigger. No bubble/outline when inactive;
/// a soft teal tint (no border) + teal accent + count when it has selections —
/// matching the blue selection fill used by the filter-sheet chips.
function FilterButton({
  Icon,
  label,
  count,
  onPress,
}: {
  Icon: React.ComponentType<IconProps>;
  label: string;
  count: number;
  onPress: () => void;
}) {
  const active = count > 0;
  const tint = active ? Brand.actionDeep : Brand.inkLabel;
  return (
    <Tactile
      haptic="tap"
      onPress={onPress}
      style={[styles.filterBtn, active && styles.filterBtnActive]}
      accessibilityLabel={`Filter by ${label}`}
    >
      <Icon size={15} color={tint} weight={active ? 'fill' : 'regular'} />
      <Text style={[styles.filterBtnText, active && styles.filterBtnTextActive]}>
        {label}{active ? ` · ${count}` : ''}
      </Text>
      <CaretDown size={11} color={active ? Brand.actionDeep : Brand.inkMuted} weight="bold" />
    </Tactile>
  );
}

function Skeleton() {
  // Mirror the DiscoveryCard silhouette: one big rounded-20 card on a 7px hard
  // shadow, with a badge top-right, a bottom-left stack (eyebrow → big title →
  // ~2-line vibe → chip row), and the reach-out circle bottom-right.
  return (
    <View style={styles.skeletonWrap}>
      <HardShadow radius={Radii.card} offset={7} style={{ flex: 1 }}>
        <View style={styles.skeletonCard}>
          <SkeletonBlock width={120} height={30} radius={14} style={styles.skelBadge} />
          <View style={styles.skelStack}>
            <SkeletonBlock width={120} height={11} radius={5} />
            <SkeletonBlock width="68%" height={30} radius={8} />
            <View style={{ gap: 7 }}>
              <SkeletonBlock width="90%" height={15} radius={6} />
              <SkeletonBlock width="62%" height={15} radius={6} />
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[70, 92, 64].map((w, i) => (
                <SkeletonBlock key={i} width={w} height={33} radius={999} />
              ))}
            </View>
          </View>
          <SkeletonBlock width={58} height={58} radius={29} style={styles.skelReach} />
        </View>
      </HardShadow>
    </View>
  );
}

/// Empty-state shown by SwipeDeck. Two distinct situations share it:
///   - exhausted (deck had cards, user swiped through them) — offer
///     "Start over", which clears skipped matches so the RPC re-surfaces them
///   - empty (no live matches at all — e.g. a brand-new campus) — be honest
///     that nothing is here yet rather than implying they swiped everything
/// Distinct from the empty/exhausted states: a failed load. Reads as a problem
/// to fix (with Retry), not as "there's nothing here."
function DeckError({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.emptyWrap}>
      <Text style={styles.emptyTitle}>Couldn't load your deck.</Text>
      <Text style={styles.emptySub}>
        Something went wrong reaching the server. Check your connection and try again.
      </Text>
      <HardShadow radius={999} offset={4} style={styles.refreshCtaWrap}>
        <Pressable onPress={onRetry} style={styles.refreshCta}>
          <ArrowsClockwise size={18} color={Brand.actionInk} weight="bold" />
          <Text style={styles.refreshCtaLabel}>Retry</Text>
        </Pressable>
      </HardShadow>
    </View>
  );
}

function DeckExhausted({ onRefresh, isOwner, neverHadCards }: { onRefresh: () => void; isOwner: boolean; neverHadCards: boolean }) {
  if (neverHadCards) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyTitle}>{isOwner ? 'No candidates yet.' : 'No projects yet.'}</Text>
        <Text style={styles.emptySub}>
          {isOwner
            ? 'Compatible seekers show up here as they join. Make sure you have a live project so they can find you too.'
            : 'New projects land here as people post them — check back soon.'}
        </Text>
        <HardShadow radius={999} offset={4} style={styles.refreshCtaWrap}>
          <Pressable onPress={onRefresh} style={styles.refreshCta}>
            <ArrowsClockwise size={18} color={Brand.actionInk} weight="bold" />
            <Text style={styles.refreshCtaLabel}>Refresh</Text>
          </Pressable>
        </HardShadow>
      </View>
    );
  }
  return (
    <View style={styles.emptyWrap}>
      <Text style={styles.emptyTitle}>You're all caught up.</Text>
      <Text style={styles.emptySub}>
        {isOwner
          ? "Want to see more candidates? Bring back the people you passed on and start fresh."
          : "Want another look? Bring back the projects you skipped and start fresh."}
      </Text>
      <HardShadow radius={999} offset={4} style={styles.refreshCtaWrap}>
        <Pressable onPress={onRefresh} style={styles.refreshCta}>
          <ArrowsClockwise size={18} color={Brand.actionInk} weight="bold" />
          <Text style={styles.refreshCtaLabel}>Start over</Text>
        </Pressable>
      </HardShadow>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Brand.canvas,
  },
  topBar: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Filter row (above the card) — borderless icon+label triggers.
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Space.lg - 4, paddingBottom: 4 },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999, // only matters when the active tint shows
  },
  filterBtnActive: { backgroundColor: 'rgba(166, 199, 194, 0.22)' }, // soft teal tint, no border
  filterBtnText: { fontFamily: AmbitFont.body, fontSize: 14, fontWeight: '600', color: Brand.inkBody },
  filterBtnTextActive: { color: Brand.actionDeep },
  filterClear: { paddingHorizontal: 8, paddingVertical: 8 },
  filterClearText: { fontFamily: AmbitFont.body, fontSize: 13.5, fontWeight: '600', color: Brand.actionDeep },

  // Demo-fallback banner (dev-only) — soft teal tint, sits above the deck.
  demoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    marginBottom: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(166, 199, 194, 0.22)',
  },
  demoBannerText: { fontFamily: AmbitFont.body, fontSize: 12, fontWeight: '600', color: Brand.actionDeep },

  // ── Filter sheet (searchable, tall + scrollable) ───────────────────────
  filterSheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, paddingHorizontal: 4 },
  filterSheetTitle: { fontFamily: AmbitFont.display, fontSize: 22, color: Brand.inkPrimary },
  filterSheetClear: { paddingVertical: 4, paddingHorizontal: 4 },
  filterSheetClearText: { fontFamily: AmbitFont.body, fontSize: 13.5, fontWeight: '700', color: Brand.inkBody },
  filterSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 12,
    backgroundColor: Brand.surface1,
    marginBottom: 16,
  },
  filterSearchInput: { flex: 1, fontFamily: AmbitFont.body, fontSize: 15, color: Brand.inkBody, padding: 0 },
  filterScroll: { flex: 1 },
  filterSheetChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 16 },
  filterSheetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: Brand.surface1,
    borderWidth: 1,
    borderColor: Brand.borderDefault,
  },
  filterSheetChipSel: { backgroundColor: Brand.action, borderWidth: 1.5, borderColor: Brand.actionInk },
  filterSheetChipText: { fontFamily: AmbitFont.body, fontSize: 14, fontWeight: '600', color: Brand.inkBody },
  filterSheetChipTextSel: { color: Brand.actionInk, fontWeight: '700' },
  filterSheetEmpty: { fontFamily: AmbitFont.body, fontSize: 14, color: Brand.inkMuted, paddingVertical: 12 },
  wordmark: {
    fontFamily: AmbitFont.display,
    fontSize: 26,
    color: Brand.inkPrimary,
    // Matches the inbox wordmark tracking so the logotype reads identically
    // across tabs (was 0.5 here vs -0.4 on inbox — an accidental drift).
    letterSpacing: -0.4,
  },
  bookmarkBtn: {
    position: 'absolute',
    right: Space.lg,
    top: 0,
    bottom: 0,
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshBtn: {
    position: 'absolute',
    left: Space.lg,
    top: 0,
    bottom: 0,
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skeletonWrap: {
    flex: 1,
    paddingHorizontal: Space.lg,
    paddingTop: Space.md,
    paddingBottom: Space.md,
  },
  skeletonCard: {
    flex: 1,
    backgroundColor: Brand.surface1,
    borderRadius: Radii.card,
    borderWidth: 1.5,
    borderColor: Brand.inkEdge,
    overflow: 'hidden',
    position: 'relative',
  },
  skelBadge: { position: 'absolute', top: 16, right: 16 },
  skelStack: { position: 'absolute', left: 22, right: 22, bottom: 22, paddingRight: 72, gap: 16 },
  skelReach: { position: 'absolute', bottom: 22, right: 22 },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: Space.xl,
  },
  emptyTitle: {
    fontFamily: AmbitFont.display,
    fontSize: 24,
    color: Brand.inkPrimary,
    textAlign: 'center',
  },
  emptySub: {
    fontFamily: AmbitFont.body,
    fontSize: 14,
    color: Brand.inkMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  refreshCtaWrap: { marginTop: 12 },
  refreshCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Brand.action,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1.6,
    borderColor: Brand.actionInk,
  },
  refreshCtaLabel: {
    fontFamily: AmbitFont.body,
    fontSize: 15,
    fontWeight: '700',
    color: Brand.actionInk,
  },
});
