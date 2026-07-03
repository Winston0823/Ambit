import React, { forwardRef, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
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
  PaperPlaneTilt,
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

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

/// Pan thresholds — hit either distance OR velocity to commit.
const SWIPE_X_DISTANCE = 120;   // pt
const SWIPE_X_VELOCITY = 0.75;  // pt/ms
const COMMIT_DURATION  = 240;   // ms — fly-off animation length

type SwipeAction = 'pass' | 'save';

/// Imperative actions the parent can drive on the deck. Reach-out lives in the
/// parent (it opens the composer + sends the message), so the parent calls
/// `commitReach()` once the send is confirmed to fly the card off.
export interface SwipeDeckHandle {
  /// Shoot the current card up off the top and advance — the terminal "reached
  /// out" exit (left = pass, right = save, up = reach). Pass the reached card's
  /// id; it's a no-op if that card is no longer the top one (e.g. the deck
  /// advanced underneath a limit sheet) or there's no card.
  commitReach: (cardId?: string) => void;
}

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
export const SwipeDeck = forwardRef<SwipeDeckHandle, Props>(function SwipeDeck({
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
}: Props, ref) {
  const [index, setIndex] = useState(0);
  const [history, setHistory] = useState<{ card: DiscoveryCardData; action: SwipeAction }[]>([]);
  const position = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  // Rewind drives `position` itself (fly-in from the side), so it opts out of
  // the index-change recenter below.
  const skipRecenter = useRef(false);

  // Recenter the shared drag value when the active card changes. Done in a
  // layout effect (after the index commit, before paint) rather than inside
  // the fly-off callback — otherwise setValue(0) snaps the still-active
  // outgoing card back to center for one frame before the swap commits, which
  // reads as the previous card flashing back in.
  useLayoutEffect(() => {
    if (skipRecenter.current) {
      skipRecenter.current = false;
      return;
    }
    position.setValue({ x: 0, y: 0 });
  }, [index, position]);

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
    // Recenter happens in the index-change layout effect (pre-paint), not here,
    // so the outgoing card is never snapped back to center mid-swap.
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
    // Opt out of the index-change recenter — we position the restored card
    // ourselves and spring it back in from the side it left.
    skipRecenter.current = true;
    setIndex((i) => Math.max(0, i - 1));
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

  // Terminal "reached out" exit: the card launches straight up off the top
  // (paper-plane sent), then the deck advances. Reaching out is a commit point
  // — you can't pass/save someone you've messaged, and you can't rewind past
  // them — so we clear the undo history. Driven by the parent once the send is
  // confirmed (see SwipeDeckHandle).
  const commitReach = (cardId?: string) => {
    // Only consume the card if it's still the top one (the deck may have moved
    // on if gestures were live behind a limit sheet).
    if (!current || (cardId !== undefined && current.id !== cardId)) return;
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    Animated.timing(position, {
      toValue: { x: 0, y: -SCREEN_H * 1.15 },
      duration: COMMIT_DURATION,
      easing: Easing.in(Easing.cubic), // accelerate away — a launch, not a drift
      useNativeDriver: true,
    }).start(() => {
      setHistory([]);
      advance();
    });
  };

  useImperativeHandle(ref, () => ({ commitReach }), [current]); // eslint-disable-line react-hooks/exhaustive-deps

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
          // Abort a committed-looking drag: if the release flick meaningfully
          // OPPOSES the card's displacement (dragged left but flung right, or
          // vice versa), the user is pulling it back — cancel to center even
          // past the distance threshold, in either direction.
          const OPPOSE_VELOCITY = 0.5; // pt/ms
          const aborting =
            (g.dx < 0 && g.vx >= OPPOSE_VELOCITY) ||
            (g.dx > 0 && g.vx <= -OPPOSE_VELOCITY);
          if (aborting) { cancelToCenter(); return; }

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
        {/* Peek (next) behind + active card on top, rendered as ONE keyed
            list. On advance the promoted card matches its key and is REORDERED
            rather than remounted — so its photo, measured height, and entry
            state persist instead of flashing back in. The next card is loaded
            (behind, scaled) one ahead, so by the time it's promoted it's painted.
            Render order [next, current] keeps the active card on top. */}
        {[next, current].map((card) => {
          if (!card) return null;
          const isActive = card.id === current.id;
          return (
            <Animated.View
              key={card.id}
              pointerEvents={isActive ? 'auto' : 'none'}
              style={[
                styles.cardLayer,
                isActive
                  ? { transform: [{ translateX: position.x }, { translateY: position.y }, { rotate }] }
                  : { transform: [{ scale: peekScale }, { translateY: peekTranslateY }] },
              ]}
              {...(isActive ? panResponder.panHandlers : {})}
              accessible={isActive || undefined}
              accessibilityLabel={isActive ? a11yLabel : undefined}
              accessibilityHint={isActive ? 'Swipe right to save, left to pass' : undefined}
              accessibilityActions={isActive ? [
                { name: 'save', label: 'Save' },
                { name: 'pass', label: 'Pass' },
                { name: 'reach', label: 'Reach out' },
                { name: 'rewind', label: 'Undo last' },
              ] : undefined}
              onAccessibilityAction={isActive ? (e) => {
                switch (e.nativeEvent.actionName) {
                  case 'save': commitSave(); break;
                  case 'pass': commitPass(); break;
                  case 'reach': reach(); break;
                  case 'rewind': rewind(); break;
                }
              } : undefined}
            >
              <DiscoveryCard
                card={card}
                matchedSkills={matchedSkills}
                onPortfolioPress={isActive ? onPortfolioPress : undefined}
                activePortfolioId={isActive ? activePortfolioId : undefined}
                onReachOut={isActive ? onReachOut : undefined}
                showReachButton={false}
                animateIn={false}
              />

              {/* Bold drag stamps — active card only. */}
              {isActive && (
                <>
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
                    <BookmarkSimple size={30} color={Brand.inkOnBrand} weight="fill" />
                    <Text style={[styles.stampLabel, styles.stampLabelSave]}>SAVE</Text>
                  </Animated.View>
                </>
              )}
            </Animated.View>
          );
        })}

        {/* Low-profile rewind — fades in only after the first decision, so
            an empty deck stays pristine. Top-center, clear of the card's
            corner status badges. */}
        {history.length > 0 && !gesturesDisabled && (
          <View style={styles.rewindWrap} pointerEvents="box-none">
            <Pressable
              onPress={rewind}
              hitSlop={10}
              style={styles.rewindBtn}
              accessibilityRole="button"
              accessibilityLabel="Undo last"
            >
              <ArrowCounterClockwise size={16} color={Brand.action} weight="bold" />
            </Pressable>
          </View>
        )}
      </View>

      {/* Action row beneath the card — pass ✕ / save bookmark / send. Each
          fires the SAME animated fly-off commit as its gesture (send opens the
          composer via the parent), so button and gesture stay identical. */}
      <View
        style={styles.actionRow}
        pointerEvents={gesturesDisabled ? 'none' : 'auto'}
      >
        <Pressable
          onPress={() => commitPass()}
          style={[styles.actionBtn, styles.actionOutline]}
          accessibilityRole="button"
          accessibilityLabel="Pass"
        >
          <X size={22} color={Brand.inkBody} weight="bold" />
        </Pressable>
        <Pressable
          onPress={() => commitSave()}
          style={[styles.actionBtn, styles.actionOutline]}
          accessibilityRole="button"
          accessibilityLabel="Save"
        >
          <BookmarkSimple size={22} color={Brand.primary} weight="regular" />
        </Pressable>
        <Pressable
          onPress={reach}
          style={[styles.actionBtn, styles.actionSend]}
          accessibilityRole="button"
          accessibilityLabel="Reach out"
        >
          <PaperPlaneTilt size={20} color={Brand.inkOnBrand} weight="fill" />
        </Pressable>
      </View>
    </View>
  );
});

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
  cardLayer: { ...StyleSheet.absoluteFillObject, borderRadius: Radii.sm },

  // Action row beneath the card — three equal-width buttons: pass / save /
  // send. Send is a solid iris fill; pass + save are warm-white with a purple
  // hairline (the ASTRA glass button family).
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: Space.md,
  },
  actionBtn: {
    flex: 1,
    height: 48,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  actionOutline: {
    backgroundColor: Brand.cardCream,
    borderColor: 'rgba(111,77,162,0.3)',
  },
  actionSend: {
    backgroundColor: Brand.selected,
    borderColor: 'rgba(111,77,162,0.3)',
  },

  // Low-profile rewind — a small glass pill floated top-center of the card,
  // clear of the corner status badges. Appears only after the first decision.
  rewindWrap: {
    position: 'absolute',
    top: 12,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 7,
  },
  rewindBtn: {
    width: 34,
    height: 34,
    borderRadius: Radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(252,249,248,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(111,77,162,0.25)',
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
    backgroundColor: 'rgba(12,0,34,0.55)', // void glass
    borderColor: Brand.inkOnBrand,
  },
  stampSave: {
    left: 20,
    backgroundColor: Brand.selected, // selected purple
    borderColor: Brand.inkOnBrand,
  },
  stampLabel: {
    fontFamily: AmbitFont.bold,
    fontSize: 18,
    letterSpacing: 2,
    color: Brand.inkOnBrand,
  },
  stampLabelSave: { color: Brand.inkOnBrand },

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
