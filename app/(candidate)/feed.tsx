import React, { useMemo, useState } from 'react';
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
  DiscoveryCardData,
  MOCK_PROJECTS,
  MOCK_SEEKERS,
} from '../../data/mock';

const SKIP_OVERVIEW_THRESHOLD = 5;

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
///   - role known → pick deck (owner→seekers, seeker/both→projects)
///   - pass → increment consecutiveSkips, push to lastFiveSeen
///   - save / message-send → reset counters
///   - consecutiveSkips reaches 5 → overlay DiscoveryOverview
export default function DiscoveryFeed() {
  const { role, loading } = useProfileRole();
  const { save } = useSavedDeck();

  // Owners see Seeker cards (recruit). Seekers + 'both' see Project cards
  // (join). 'both' defaults to seeker view in v1 — owner toggle ships with
  // the Profile menu later.
  const deck = useMemo<DiscoveryCardData[]>(
    () => (role === 'owner' ? MOCK_SEEKERS : MOCK_PROJECTS),
    [role],
  );

  // Skip counter + recent-five buffer drive the overview interstitial.
  const [consecutiveSkips, setConsecutiveSkips] = useState(0);
  const [lastFiveSeen, setLastFiveSeen] = useState<DiscoveryCardData[]>([]);
  /// Re-mount key for SwipeDeck. Bumping this resets the deck's internal
  /// index to 0 — used when the overview reinserts a card at the head.
  const [deckResetKey, setDeckResetKey] = useState(0);
  /// When the overview reinserts a card, we prepend it to this list. Combined
  /// with the role-mapped deck via memo below.
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
  };

  const handleSave = (card: DiscoveryCardData) => {
    save(card);
    setConsecutiveSkips(0);
    setLastFiveSeen([]);
  };

  const handleMessage = (_card: DiscoveryCardData, _text: string) => {
    // Messaging integration lands later. For now the card commits up
    // off-screen via SwipeDeck and we just reset the counters.
    setConsecutiveSkips(0);
    setLastFiveSeen([]);
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

      {/* Content layer — three states. */}
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

// ─── Skeleton ──────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <View style={styles.skeletonWrap}>
      <View style={styles.skeletonCard} />
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Brand.canvas,
  },

  // Top bar — wordmark centered, bookmark right-aligned via absolute
  // positioning so the wordmark stays visually centered regardless of
  // icon width.
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

  // Skeleton — blank card-shaped surface; calmer than a spinner and keeps
  // layout stable while role resolves.
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
