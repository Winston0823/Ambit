import React, { useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  PanResponder,
  PanResponderGestureState,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  ArrowCounterClockwise,
  BookmarkSimple,
  X,
} from 'phosphor-react-native';
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

/// Pan thresholds — hit either distance OR velocity to commit.
const SWIPE_X_DISTANCE = 120;   // pt
const SWIPE_X_VELOCITY = 0.75;  // pt/ms
const COMMIT_DURATION  = 240;   // ms — fly-off animation length

type SwipeAction = 'pass' | 'save';

interface Props {
  deck: DiscoveryCardData[];
  onPass: (card: DiscoveryCardData) => void;
  onSave: (card: DiscoveryCardData) => void;
  onReachOut?: (card: DiscoveryCardData) => void;
  /// Undo of the last pass/save. Parent reverses the side-effect (un-save,
  /// delete the match row, decrement skip counters, etc.).
  onRewind?: (card: DiscoveryCardData, action: SwipeAction) => void;
  emptyState?: React.ReactNode;
  matchedSkills?: string[];
  onPortfolioPress?: (item: PortfolioItem) => void;
  activePortfolioId?: string | null;
  /// Pause gestures + action buttons while an overlay (composer, portfolio
  /// modal) is in front.
  gesturesDisabled?: boolean;
}

/// Horizontal swipe deck with a persistent action row (rewind · pass · save ·
/// reach), a peeking next card for depth, and bold icon drag-stamps.
///
///   - Swipe left / Pass button  → pass.
///   - Swipe right / Save button → save.
///   - Reach button              → opens the composer (parent).
///   - Rewind button             → undo the last decision.
///
/// Animation idiom: Animated.ValueXY + PanResponder + native driver (no
/// Reanimated; Expo Go can't host the worklet runtime).
export function SwipeDeck({
  deck,
  onPass,
  onSave,
  onReachOut,
  onRewind,
  emptyState,
  matchedSkills,
  onPortfolioPress,
  activePortfolioId,
  gesturesDisabled,
}: Props) {
  const [index, setIndex] = useState(0);
  const [history, setHistory] = useState<{ card: DiscoveryCardData; action: SwipeAction }[]>([]);
  const position = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  const current = deck[index];
  const next = deck[index + 1];

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
  const saveStampOpacity = useMemo(
    () => position.x.interpolate({ inputRange: [0, 40, 130], outputRange: [0, 0.4, 1], extrapolate: 'clamp' }),
    [position.x],
  );
  const passStampOpacity = useMemo(
    () => position.x.interpolate({ inputRange: [-130, -40, 0], outputRange: [1, 0.4, 0], extrapolate: 'clamp' }),
    [position.x],
  );
  const saveStampScale = useMemo(
    () => position.x.interpolate({ inputRange: [0, 130], outputRange: [0.6, 1], extrapolate: 'clamp' }),
    [position.x],
  );
  const passStampScale = useMemo(
    () => position.x.interpolate({ inputRange: [-130, 0], outputRange: [1, 0.6], extrapolate: 'clamp' }),
    [position.x],
  );
  // Peeking next card grows toward full size as the top card leaves either side.
  const peekScale = useMemo(
    () => position.x.interpolate({ inputRange: [-SCREEN_W, 0, SCREEN_W], outputRange: [1, 0.94, 1], extrapolate: 'clamp' }),
    [position.x],
  );
  const peekTranslateY = useMemo(
    () => position.x.interpolate({ inputRange: [-SCREEN_W, 0, SCREEN_W], outputRange: [0, 16, 0], extrapolate: 'clamp' }),
    [position.x],
  );

  // ─── Commit handlers ─────────────────────────────────────────────────────
  const advance = () => {
    position.setValue({ x: 0, y: 0 });
    setIndex((i) => i + 1);
  };

  const commitPass = (gesture?: PanResponderGestureState) => {
    if (!current) return;
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    const card = current;
    Animated.timing(position, {
      toValue: { x: -SCREEN_W * 1.4, y: gesture?.dy ?? 0 },
      duration: COMMIT_DURATION,
      useNativeDriver: true,
    }).start(() => {
      onPass(card);
      setHistory((h) => [...h, { card, action: 'pass' }]);
      advance();
    });
  };

  const commitSave = (gesture?: PanResponderGestureState) => {
    if (!current) return;
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    const card = current;
    Animated.timing(position, {
      toValue: { x: SCREEN_W * 1.4, y: gesture?.dy ?? 0 },
      duration: COMMIT_DURATION,
      useNativeDriver: true,
    }).start(() => {
      onSave(card);
      setHistory((h) => [...h, { card, action: 'save' }]);
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

  const rewind = () => {
    if (history.length === 0) return;
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    const last = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setIndex((i) => Math.max(0, i - 1));
    // Fly the restored card back in from the side it left.
    position.setValue({ x: last.action === 'pass' ? -SCREEN_W : SCREEN_W, y: 0 });
    Animated.spring(position, {
      toValue: { x: 0, y: 0 },
      friction: 6,
      tension: 70,
      useNativeDriver: true,
    }).start();
    onRewind?.(last.card, last.action);
  };

  const reach = () => {
    if (!current) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onReachOut?.(current);
  };

  // ─── PanResponder ─────────────────────────────────────────────────────────
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_e, g) => {
          if (gesturesDisabled) return false;
          return Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2;
        },
        onPanResponderMove: (_e, g) => {
          position.setValue({ x: g.dx, y: 0 });
        },
        onPanResponderRelease: (_e, g) => {
          const passed = g.dx <= -SWIPE_X_DISTANCE || g.vx <= -SWIPE_X_VELOCITY;
          const saved = g.dx >= SWIPE_X_DISTANCE || g.vx >= SWIPE_X_VELOCITY;
          if (passed) commitPass(g);
          else if (saved) commitSave(g);
          else cancelToCenter();
        },
        onPanResponderTerminate: () => cancelToCenter(),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [current?.id, gesturesDisabled],
  );

  // ─── Render ──────────────────────────────────────────────────────────────
  if (!current) {
    return <View style={styles.root}>{emptyState ?? <DefaultEmpty />}</View>;
  }

  // One VoiceOver element with custom rotor actions, so swipe-only controls
  // are still operable by screen-reader users without any visible buttons.
  const a11yLabel =
    current.kind === 'seeker'
      ? `${current.name}. ${current.vibeBlurb}`
      : `${current.title}, by ${current.ownerName}. ${current.pitch}`;

  return (
    <View style={styles.root}>
      <View style={styles.cardArea}>
        {/* Peeking next card — depth cue behind the active card. */}
        {next && (
          <Animated.View
            pointerEvents="none"
            style={[styles.cardLayer, { transform: [{ scale: peekScale }, { translateY: peekTranslateY }] }]}
          >
            <DiscoveryCard key={next.id} card={next} matchedSkills={matchedSkills} showReachButton={false} />
          </Animated.View>
        )}

        {/* Active card. Swipe = pass/save; the card's own glass button =
            reach. No separate control band. */}
        <Animated.View
          style={[
            styles.cardLayer,
            { transform: [{ translateX: position.x }, { translateY: position.y }, { rotate }] },
          ]}
          {...panResponder.panHandlers}
          accessible
          accessibilityLabel={a11yLabel}
          accessibilityHint="Swipe right to save, left to pass"
          accessibilityActions={[
            { name: 'save', label: 'Save' },
            { name: 'pass', label: 'Pass' },
            { name: 'reach', label: 'Reach out' },
            { name: 'rewind', label: 'Undo last' },
          ]}
          onAccessibilityAction={(e) => {
            switch (e.nativeEvent.actionName) {
              case 'save': commitSave(); break;
              case 'pass': commitPass(); break;
              case 'reach': reach(); break;
              case 'rewind': rewind(); break;
            }
          }}
        >
          <DiscoveryCard
            key={current.id}
            card={current}
            matchedSkills={matchedSkills}
            onPortfolioPress={onPortfolioPress}
            activePortfolioId={activePortfolioId}
            onReachOut={onReachOut}
          />

          {/* Bold drag stamps. */}
          <Animated.View
            pointerEvents="none"
            style={[styles.stamp, styles.stampPass, { opacity: passStampOpacity, transform: [{ rotate: '14deg' }, { scale: passStampScale }] }]}
          >
            <X size={30} color={Brand.inkOnBrand} weight="bold" />
            <Text style={styles.stampLabel}>PASS</Text>
          </Animated.View>
          <Animated.View
            pointerEvents="none"
            style={[styles.stamp, styles.stampSave, { opacity: saveStampOpacity, transform: [{ rotate: '-14deg' }, { scale: saveStampScale }] }]}
          >
            <BookmarkSimple size={30} color={Brand.seekerInk} weight="fill" />
            <Text style={[styles.stampLabel, styles.stampLabelSave]}>SAVE</Text>
          </Animated.View>
        </Animated.View>

        {/* Low-profile rewind — fades in only after the first decision, so
            an empty deck stays pristine. */}
        {history.length > 0 && !gesturesDisabled && (
          <Pressable
            onPress={rewind}
            hitSlop={10}
            style={styles.rewindBtn}
            accessibilityRole="button"
            accessibilityLabel="Undo last"
          >
            <ArrowCounterClockwise size={18} color={Brand.inkOnBrand} weight="bold" />
          </Pressable>
        )}
      </View>
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
    // Tighter top so the card reclaims height + sits closer to the filter row
    // (the row above already provides the breathing room from the wordmark).
    paddingTop: Space.sm,
    paddingBottom: Space.md,
  },
  cardArea: { flex: 1, position: 'relative' },
  cardLayer: { ...StyleSheet.absoluteFillObject, borderRadius: Radii.lg },

  // Low-profile rewind, top-left of the card (clear of the top-right match
  // badge). Translucent so it sits on the photo without competing.
  rewindBtn: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20,20,20,0.42)',
    zIndex: 7,
  },

  // ── Drag stamps ──────────────────────────────────────────────────────────
  stamp: {
    position: 'absolute',
    top: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radii.md,
    borderWidth: 3,
    zIndex: 6,
  },
  stampPass: {
    right: 20,
    backgroundColor: 'rgba(20,20,20,0.55)',
    borderColor: Brand.inkOnBrand,
  },
  stampSave: {
    left: 20,
    backgroundColor: 'rgba(242,232,221,0.9)',
    borderColor: Brand.seekerInk,
  },
  stampLabel: {
    fontFamily: AmbitFont.body,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 2,
    color: Brand.inkOnBrand,
  },
  stampLabelSave: { color: Brand.seekerInk },

  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: Space.xl,
  },
  emptyTitle: { ...TypeScale.h1, fontSize: 24, color: Brand.inkPrimary, textAlign: 'center' },
  emptySub: { ...TypeScale.body, color: Brand.inkMuted, textAlign: 'center' },
});
