import React, { useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  PanResponder,
  PanResponderGestureState,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { DiscoveryCard } from '../molecules';
import {
  AmbitFont,
  Brand,
  Radii,
  Space,
  TypeScale,
} from '../../constants/theme';
import type { DiscoveryCardData, PortfolioItem } from '../../data/mock';

const { width: SCREEN_W } = Dimensions.get('window');

/// Pan thresholds — horizontal-only now that swipe-up has been retired
/// in favor of the pinned Reach Out button on each card. Hit either
/// distance OR velocity to commit.
const SWIPE_X_DISTANCE = 120;   // pt
const SWIPE_X_VELOCITY = 0.75;  // pt/ms
const COMMIT_DURATION  = 240;   // ms — fly-off animation length

interface Props {
  deck: DiscoveryCardData[];
  onPass: (card: DiscoveryCardData) => void;
  onSave: (card: DiscoveryCardData) => void;
  /// Tapped on the pinned "Reach out" footer inside the active card.
  /// Forwarded to DiscoveryCard; parent opens the ReachOutComposer modal.
  onReachOut?: (card: DiscoveryCardData) => void;
  /// Render this when the deck is exhausted (no more cards to show).
  emptyState?: React.ReactNode;
  /// Project skills used to highlight matching chips on seeker cards.
  matchedSkills?: string[];
  /// Fired when a portfolio bubble on the active (seeker) card is tapped.
  onPortfolioPress?: (item: PortfolioItem) => void;
  activePortfolioId?: string | null;
  /// When true, the PanResponder ignores movement. Used by the parent to
  /// pause swipes while an overlay (portfolio modal, reach-out composer,
  /// etc.) is in front.
  gesturesDisabled?: boolean;
}

/// Horizontal swipe deck. One card at a time, no peek.
///
/// Gestures — substantially simpler after retiring the swipe-up composer:
///   - Horizontal left  → pass.  Card flies off-screen left.
///   - Horizontal right → save.  Card flies off-screen right.
///   - Vertical drag inside the card → handled by the card's own
///     ScrollView (no gesture conflict with this deck).
///
/// Reach-out is now a tap on the pinned footer button inside DiscoveryCard,
/// which fires `onReachOut`. Parent opens a modal composer in response.
///
/// Animation idiom: legacy Animated.ValueXY + PanResponder + native driver.
/// Matches the rest of this codebase (no Reanimated since Expo Go can't
/// host the worklet runtime).
export function SwipeDeck({
  deck,
  onPass,
  onSave,
  onReachOut,
  emptyState,
  matchedSkills,
  onPortfolioPress,
  activePortfolioId,
  gesturesDisabled,
}: Props) {
  const [index, setIndex] = useState(0);
  const position = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  const current = deck[index];

  // ─── Derived animated values ─────────────────────────────────────────────
  const rotate = useMemo(
    () =>
      position.x.interpolate({
        inputRange: [-SCREEN_W, 0, SCREEN_W],
        outputRange: ['-10deg', '0deg', '10deg'],
        extrapolate: 'clamp',
      }),
    [position.x],
  );
  const saveTintOpacity = useMemo(
    () =>
      position.x.interpolate({
        inputRange: [0, 60, 160],
        outputRange: [0, 0.35, 0.7],
        extrapolate: 'clamp',
      }),
    [position.x],
  );
  const passTintOpacity = useMemo(
    () =>
      position.x.interpolate({
        inputRange: [-160, -60, 0],
        outputRange: [0.7, 0.35, 0],
        extrapolate: 'clamp',
      }),
    [position.x],
  );

  // ─── Commit handlers ─────────────────────────────────────────────────────

  const advance = () => {
    position.setValue({ x: 0, y: 0 });
    setIndex((i) => i + 1);
  };

  const commitPass = (gesture?: PanResponderGestureState) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    Animated.timing(position, {
      toValue: { x: -SCREEN_W * 1.4, y: gesture?.dy ?? 0 },
      duration: COMMIT_DURATION,
      useNativeDriver: true,
    }).start(() => {
      if (current) onPass(current);
      advance();
    });
  };

  const commitSave = (gesture?: PanResponderGestureState) => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    Animated.timing(position, {
      toValue: { x: SCREEN_W * 1.4, y: gesture?.dy ?? 0 },
      duration: COMMIT_DURATION,
      useNativeDriver: true,
    }).start(() => {
      if (current) onSave(current);
      advance();
    });
  };

  const cancelToCenter = () => {
    Animated.spring(position, {
      toValue: { x: 0, y: 0 },
      friction: 5,
      tension: 80,
      useNativeDriver: true,
    }).start();
  };

  // ─── PanResponder ─────────────────────────────────────────────────────────

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // Don't claim the gesture on touch start — the card's internal
        // ScrollView needs to handle vertical drags. We only claim when
        // movement is dominantly horizontal.
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_e, g) => {
          if (gesturesDisabled) return false;
          // Horizontal intent required. The 1.2 ratio ensures vertical
          // scroll inside the card content wins for ambiguous diagonals.
          return Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2;
        },

        onPanResponderMove: (_e, g) => {
          // Horizontal only. We don't translate the card vertically here;
          // any small dy is treated as drift, not intent.
          position.setValue({ x: g.dx, y: 0 });
        },

        onPanResponderRelease: (_e, g) => {
          const passed =
            g.dx <= -SWIPE_X_DISTANCE || g.vx <= -SWIPE_X_VELOCITY;
          const saved =
            g.dx >= SWIPE_X_DISTANCE || g.vx >= SWIPE_X_VELOCITY;

          if (passed) commitPass(g);
          else if (saved) commitSave(g);
          else cancelToCenter();
        },
        onPanResponderTerminate: () => cancelToCenter(),
      }),
    // PanResponder closes over `current` (for onPass/onSave) and
    // `gesturesDisabled`. Rebuild when either changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [current?.id, gesturesDisabled],
  );

  // ─── Render ──────────────────────────────────────────────────────────────

  if (!current) {
    return <View style={styles.root}>{emptyState ?? <DefaultEmpty />}</View>;
  }

  return (
    <View style={styles.root}>
      <Animated.View
        style={[
          styles.cardWrap,
          {
            transform: [
              { translateX: position.x },
              { translateY: position.y },
              { rotate },
            ],
          },
        ]}
        {...panResponder.panHandlers}
      >
        <DiscoveryCard
          key={current.id}
          card={current}
          matchedSkills={matchedSkills}
          onPortfolioPress={onPortfolioPress}
          activePortfolioId={activePortfolioId}
          onReachOut={onReachOut}
        />

        {/* Edge tints — appear mid-swipe so the user knows which side the
            card is heading to. PASS on the left (card flies left), SAVE on
            the right (card flies right). Opacity interpolated from the
            card's translation. */}
        <Animated.View
          pointerEvents="none"
          style={[styles.edgeTint, styles.edgeTintPass, { opacity: passTintOpacity }]}
        >
          <Text style={styles.edgeTintLabel}>PASS</Text>
        </Animated.View>
        <Animated.View
          pointerEvents="none"
          style={[styles.edgeTint, styles.edgeTintSave, { opacity: saveTintOpacity }]}
        >
          <Text style={[styles.edgeTintLabel, styles.edgeTintLabelSave]}>SAVE</Text>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

// ─── Empty state ───────────────────────────────────────────────────────────

function DefaultEmpty() {
  return (
    <View style={styles.emptyWrap}>
      <Text style={styles.emptyTitle}>You're all caught up.</Text>
      <Text style={styles.emptySub}>Check back tomorrow for fresh matches.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: Space.lg,
    paddingTop: Space.md,
    paddingBottom: Space.md,
  },
  cardWrap: {
    flex: 1,
    borderRadius: Radii.lg,
  },

  edgeTint: {
    position: 'absolute',
    top: 24,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radii.sm,
    borderWidth: 2,
  },
  edgeTintLabel: {
    fontFamily: AmbitFont.body,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: Brand.inkMuted,
  },
  edgeTintLabelSave: {
    color: Brand.seekerInk,
  },
  edgeTintPass: {
    left: Space.lg + 16,
    backgroundColor: Brand.surface1,
    borderColor: Brand.inkMuted,
  },
  edgeTintSave: {
    right: Space.lg + 16,
    backgroundColor: Brand.seekerSurface,
    borderColor: Brand.seekerInk,
  },

  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: Space.xl,
  },
  emptyTitle: {
    ...TypeScale.h1,
    fontSize: 24,
    color: Brand.inkPrimary,
    textAlign: 'center',
  },
  emptySub: {
    ...TypeScale.body,
    color: Brand.inkMuted,
    textAlign: 'center',
  },
});
