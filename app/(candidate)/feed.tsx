import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { DiscoveryOverview, SwipeDeck } from '../../components/organisms';
import { PortfolioModal, ReachOutComposer, BottomSheet, ReachOutLimitSheet } from '../../components/molecules';
import { Tactile } from '../../components/atoms';
import { CAMPUSES } from '../../data/mock';
import {
  canReachOut,
  recordReachOut,
  getReachOutStatus,
} from '../../lib/reachOutLimit';
import type { PortfolioItem } from '../../data/mock';
import { useProfileRole } from '../../hooks/useProfileRole';
import { useSavedDeck } from '../../context/SavedDeckContext';
import {
  AmbitFont,
  Brand,
  Radii,
  Space,
} from '../../constants/theme';
import {
  type DiscoveryCardData,
  type ProjectCardData,
  type SeekerCardData,
  MOCK_PROJECTS,
  MOCK_SEEKERS,
} from '../../data/mock';
import { supabase } from '../../lib/supabase';
import { sendProjectAttachment, startConversationWithMessage } from '../../lib/messaging';
import { fetchPortfoliosByUser } from '../../lib/portfolio';
import { useAuth } from '../../context/AuthContext';

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

const CARD_GRADIENTS: [string, string][] = [
  [Brand.primary, Brand.accent],
  ['#C9A57A', Brand.seekerInk],
  [Brand.seekerSurface, Brand.accent],
  ['#E8C9A0', Brand.primary],
  [Brand.accent, '#7A5A38'],
  ['#D4B490', '#4D361D'],
  [Brand.seekerSurface, '#B48045'],
];

/// Fetches ranked projects for a seeker and maps them to ProjectCardData.
/// Falls back to MOCK_PROJECTS if the RPC fails or returns nothing.
async function fetchProjectDeck(userId: string): Promise<ProjectCardData[]> {
  const { data: ranked, error } = await supabase.rpc(
    'compat_projects_for_seeker',
    { p_seeker_id: userId, p_limit: 30 }
  );

  if (error || !ranked || ranked.length === 0) return MOCK_PROJECTS;

  const rows = ranked as {
    project_id: string;
    title: string;
    vibe_blurb: string;
    required_skills: string[];
    roles_sought: string[];
    campus_id: string | null;
    owner_id: string;
    score: number;
    skill_match_pct: number;
  }[];

  const ownerIds = [...new Set(rows.map((r) => r.owner_id))];
  const { data: owners } = await supabase
    .from('profiles')
    .select('id, name, photo_url')
    .in('id', ownerIds);

  const ownerMap = Object.fromEntries(
    (owners ?? []).map((o: { id: string; name: string; photo_url: string | null }) => [
      o.id,
      { name: o.name, photoUri: o.photo_url },
    ])
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
    };
  });
}

/// Fetches compatible seekers for an owner's first active project.
/// Falls back to MOCK_SEEKERS if none found.
async function fetchSeekerDeck(userId: string): Promise<SeekerCardData[]> {
  const { data: projects } = await supabase
    .from('projects')
    .select('id')
    .eq('owner_id', userId)
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(1);

  if (!projects || projects.length === 0) return MOCK_SEEKERS;

  const projectId = (projects[0] as { id: string }).id;
  const { data: ranked, error } = await supabase.rpc('compat_for_project', {
    p_project_id: projectId,
    p_limit: 30,
  });

  if (error || !ranked || ranked.length === 0) return MOCK_SEEKERS;

  const rows = ranked as { seeker_id: string; score: number }[];
  const seekerIds = rows.map((r) => r.seeker_id);

  const { data: seekers } = await supabase
    .from('profiles')
    .select('id, name, photo_url, campus_id, skills, vibe_blurb')
    .in('id', seekerIds);

  if (!seekers || seekers.length === 0) return MOCK_SEEKERS;

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
    try {
      const data =
        role === 'owner'
          ? await fetchSeekerDeck(user.id)
          : await fetchProjectDeck(user.id);
      setLiveDeck(data);
    } finally {
      setDeckLoading(false);
    }
  }, [user, role, roleLoading]);

  useEffect(() => {
    fetchDeck();
  }, [fetchDeck]);

  const deck = useMemo<DiscoveryCardData[]>(
    () => liveDeck ?? (role === 'owner' ? MOCK_SEEKERS : MOCK_PROJECTS),
    [liveDeck, role]
  );

  const [consecutiveSkips, setConsecutiveSkips] = useState(0);
  const [lastFiveSeen, setLastFiveSeen] = useState<DiscoveryCardData[]>([]);
  const [deckResetKey, setDeckResetKey] = useState(0);
  const [reinserted, setReinserted] = useState<DiscoveryCardData[]>([]);

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
        await sendProjectAttachment({
          conversationId,
          senderId: user.id,
          projectId: attachment.id,
          projectTitle: attachment.title,
        }).catch(() => {});
      }
      return true;
    } catch (e: any) {
      console.warn('reach out failed:', e?.message ?? e);
      return false;
    }
  };

  /// Called by the composer after a confirmed send. Resets the skip
  /// counters and closes the composer; we stay in the deck.
  const handleReachSent = () => {
    setConsecutiveSkips(0);
    setLastFiveSeen([]);
    setReachOutCard(null);
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

      {loading ? (
        <Skeleton />
      ) : overviewVisible ? (
        <DiscoveryOverview
          seen={lastFiveSeen}
          onPick={handleOverviewPick}
          onContinue={handleOverviewContinue}
        />
      ) : (
        <SwipeDeck
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
          emptyState={<DeckExhausted onRefresh={handleRefresh} isOwner={role === 'owner'} />}
        />
      )}

      {/* Reach Out composer — opens when the user taps the pinned footer
          button on a card. Sending fires handleMessage which creates (or
          finds) the conversation and resets the skip counter. */}
      <ReachOutComposer
        card={reachOutCard}
        onDismiss={() => setReachOutCard(null)}
        onSend={async (card, text) => {
          const ok = await handleMessage(card, text);
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
/// a soft warm-tan tint (no border) + accent + count when it has selections.
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
  const tint = active ? Brand.accent : Brand.inkLabel;
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
      <CaretDown size={11} color={active ? Brand.accent : Brand.inkMuted} weight="bold" />
    </Tactile>
  );
}

function Skeleton() {
  return (
    <View style={styles.skeletonWrap}>
      <View style={styles.skeletonCard} />
    </View>
  );
}

/// Empty-state shown by SwipeDeck once the deck is exhausted. The
/// "Start over" CTA wires into feed.tsx's handleRefresh — clears the
/// user's skipped matches so the RPC re-surfaces them.
function DeckExhausted({ onRefresh, isOwner }: { onRefresh: () => void; isOwner: boolean }) {
  return (
    <View style={styles.emptyWrap}>
      <Text style={styles.emptyTitle}>You're all caught up.</Text>
      <Text style={styles.emptySub}>
        {isOwner
          ? "Want to see more candidates? Bring back the people you passed on and start fresh."
          : "Want another look? Bring back the projects you skipped and start fresh."}
      </Text>
      <Pressable onPress={onRefresh} style={styles.refreshCta}>
        <ArrowsClockwise size={18} color={Brand.inkOnBrand} weight="bold" />
        <Text style={styles.refreshCtaLabel}>Start over</Text>
      </Pressable>
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
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999, // only matters when the active tint shows
  },
  filterBtnActive: { backgroundColor: 'rgba(212, 180, 144, 0.18)' }, // soft warm tint, no border
  filterBtnText: { fontFamily: AmbitFont.body, fontSize: 14, fontWeight: '600', color: Brand.inkBody },
  filterBtnTextActive: { color: Brand.accent },
  filterClear: { paddingHorizontal: 8, paddingVertical: 6 },
  filterClearText: { fontFamily: AmbitFont.body, fontSize: 13.5, fontWeight: '600', color: Brand.accent },

  // ── Filter sheet (searchable, tall + scrollable) ───────────────────────
  filterSheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, paddingHorizontal: 4 },
  filterSheetTitle: { fontFamily: AmbitFont.display, fontSize: 22, color: Brand.inkPrimary },
  filterSheetClear: { paddingVertical: 4, paddingHorizontal: 4 },
  filterSheetClearText: { fontFamily: AmbitFont.body, fontSize: 13.5, fontWeight: '600', color: Brand.accent },
  filterSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 12,
    backgroundColor: Brand.surface1,
    marginBottom: 14,
  },
  filterSearchInput: { flex: 1, fontFamily: AmbitFont.body, fontSize: 15, color: Brand.inkBody, padding: 0 },
  filterScroll: { flex: 1 },
  filterSheetChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 16 },
  filterSheetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: Brand.surface1,
    borderWidth: 1,
    borderColor: Brand.borderDefault,
  },
  filterSheetChipSel: { backgroundColor: Brand.action, borderColor: Brand.actionInk },
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
    borderRadius: Radii.lg,
  },
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
  refreshCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Brand.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: Radii.md,
    marginTop: 12,
  },
  refreshCtaLabel: {
    fontFamily: AmbitFont.body,
    fontSize: 15,
    fontWeight: '600',
    color: Brand.inkOnBrand,
  },
});
