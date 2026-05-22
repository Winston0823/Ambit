import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { BookmarkSimple } from 'phosphor-react-native';
import * as Haptics from 'expo-haptics';
import { DiscoveryOverview, SwipeDeck } from '../../components/organisms';
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
import { startConversationWithMessage } from '../../lib/messaging';
import { useAuth } from '../../context/AuthContext';

const SKIP_OVERVIEW_THRESHOLD = 5;

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
      title: r.title,
      pitch: r.vibe_blurb || r.title,
      ownerName: ownerMap[r.owner_id]?.name ?? 'Unknown',
      ownerPhotoUri: ownerMap[r.owner_id]?.photoUri ?? null,
      ownerCampusId: r.campus_id ?? '',
      whyMatched,
      skillsSought: r.required_skills.slice(0, 5),
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

  return (seekers as {
    id: string;
    name: string;
    photo_url: string | null;
    campus_id: string | null;
    skills: string[];
    vibe_blurb: string;
  }[])
    .sort((a, b) => (scoreMap[b.id] ?? 0) - (scoreMap[a.id] ?? 0))
    .map((s): SeekerCardData => ({
      kind: 'seeker',
      id: s.id,
      name: s.name ?? 'Unknown',
      photoUri: s.photo_url,
      campusId: s.campus_id ?? '',
      skills: s.skills ?? [],
      vibeBlurb: s.vibe_blurb ?? '',
      portfolioHighlight: '',
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
  const { save } = useSavedDeck();
  const { user } = useAuth();

  const [liveDeck, setLiveDeck] = useState<DiscoveryCardData[] | null>(null);
  const [deckLoading, setDeckLoading] = useState(false);

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

  const activeDeck = useMemo(
    () => [...reinserted, ...deck.filter((c) => !reinserted.some((r) => r.id === c.id))],
    [reinserted, deck],
  );

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

  /// Composer-send. Creates (or finds) a conversation, posts the first
  /// message, and navigates into the thread. Also records the match
  /// outcome as 'applied' so the discovery feed doesn't show the same
  /// project again. Seeker-side: project_id = card.id, seeker = me.
  /// Owner-side: project_id = my first active project, seeker = card.id.
  const handleMessage = async (card: DiscoveryCardData, text: string) => {
    setConsecutiveSkips(0);
    setLastFiveSeen([]);
    if (!user) return;

    try {
      let projectId: string;
      let seekerId:  string;

      if (card.kind === 'project') {
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
          console.warn('Owner has no active project to anchor a conversation.');
          return;
        }
        projectId = (proj as { id: string }).id;
        seekerId  = card.id;
      }

      const conversationId = await startConversationWithMessage({
        projectId,
        seekerId,
        body: text,
      });
      router.push({ pathname: '/thread', params: { id: conversationId } });
    } catch (e: any) {
      console.warn('start_conversation_with_message failed:', e?.message ?? e);
    }
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

  const goToSaved = () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    router.push('/saved');
  };

  const loading = roleLoading || deckLoading;

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
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
          key={deckResetKey}
          deck={activeDeck}
          onPass={handlePass}
          onSave={handleSave}
          onMessageSend={handleMessage}
        />
      )}
    </View>
  );
}

function Skeleton() {
  return (
    <View style={styles.skeletonWrap}>
      <View style={styles.skeletonCard} />
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
  wordmark: {
    fontFamily: AmbitFont.display,
    fontSize: 26,
    color: Brand.inkPrimary,
    letterSpacing: 0.5,
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
});
