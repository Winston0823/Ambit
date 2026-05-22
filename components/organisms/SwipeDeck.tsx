import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Keyboard,
  PanResponder,
  PanResponderGestureState,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Bookmark, PaperPlaneTilt, X } from 'phosphor-react-native';
import { DiscoveryCard } from '../molecules';
import {
  AmbitFont,
  Brand,
  Radii,
  Space,
  TypeScale,
} from '../../constants/theme';
import type { DiscoveryCardData } from '../../data/mock';

const { width: SCREEN_W } = Dimensions.get('window');

/// Pan thresholds. Hit either distance OR velocity to commit.
const SWIPE_X_DISTANCE = 120;   // pt
const SWIPE_X_VELOCITY = 0.6;   // pt/ms
const SWIPE_UP_DISTANCE = 80;   // pt (toward composer reveal)
const COMPOSER_RESTING_Y = -120; // where the card sits while composing
const COMMIT_DURATION = 240;    // ms — fly-off animation length

interface Props {
  deck: DiscoveryCardData[];
  onPass: (card: DiscoveryCardData) => void;
  onSave: (card: DiscoveryCardData) => void;
  onMessageSend: (card: DiscoveryCardData, text: string) => void;
  /// Render this when the deck is exhausted (no more cards to show).
  emptyState?: React.ReactNode;
}

/// Tinder-style swipe deck. One card at a time, no peek.
///
/// Gestures:
///   - Horizontal left  → pass.  Card flies off-screen left.
///   - Horizontal right → save.  Card flies off-screen right.
///   - Vertical   up    → message reveal. Card lifts to make room for a
///                        composer beneath it. Send commits the card up
///                        off-screen; X cancels back to center.
///
/// Animation idiom: legacy Animated.ValueXY + PanResponder + native driver
/// for transforms. Matches the rest of this codebase (no Reanimated since
/// Expo Go can't host the worklet runtime).
export function SwipeDeck({ deck, onPass, onSave, onMessageSend, emptyState }: Props) {
  const [index, setIndex] = useState(0);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerText, setComposerText] = useState('');

  /// Bind the composer's bottom offset to the live keyboard height so it
  /// always sits flush above the keyboard's top edge. We listen directly
  /// instead of using KeyboardAvoidingView because the composer wrap is
  /// `position: 'absolute', bottom: 0` — KeyboardAvoidingView's "padding"
  /// behavior only works in flex layouts (it adds padding *inside* an
  /// absolute container, which doesn't move the container itself).
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvt, (e) => {
      setKeyboardOffset(e.endCoordinates?.height ?? 0);
    });
    const hideSub = Keyboard.addListener(hideEvt, () => setKeyboardOffset(0));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);
  const position = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  const current = deck[index];

  // ─── Derived animated values ─────────────────────────────────────────────
  // Memoized so they aren't rebuilt every render; useNativeDriver-friendly.
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

  const revealComposer = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    setComposerOpen(true);
    Animated.spring(position, {
      toValue: { x: 0, y: COMPOSER_RESTING_Y },
      friction: 7,
      tension: 80,
      useNativeDriver: true,
    }).start();
  };

  const dismissComposer = () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    setComposerOpen(false);
    setComposerText('');
    Animated.spring(position, {
      toValue: { x: 0, y: 0 },
      friction: 6,
      tension: 90,
      useNativeDriver: true,
    }).start();
  };

  /// Snap the card back to its composer-resting position without closing
  /// the composer. Used when a downward pan starts but doesn't pass the
  /// dismiss threshold — the card should bounce back up, not stay halfway.
  const snapToComposerRest = () => {
    Animated.spring(position, {
      toValue: { x: 0, y: COMPOSER_RESTING_Y },
      friction: 7,
      tension: 80,
      useNativeDriver: true,
    }).start();
  };

  const commitMessage = () => {
    const text = composerText.trim();
    if (!text || !current) return;
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    Animated.timing(position, {
      toValue: { x: 0, y: -SCREEN_W * 1.8 },
      duration: COMMIT_DURATION,
      useNativeDriver: true,
    }).start(() => {
      onMessageSend(current, text);
      setComposerOpen(false);
      setComposerText('');
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
        // Only claim the gesture once the finger has clearly moved — keeps
        // child taps (chips, buttons later) working until we know the user
        // really meant to swipe.
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_e, g) => {
          // While composing: only claim downward intent so the user can
          // still scroll/select inside the composer without the card
          // chasing every micro-movement.
          if (composerOpen) return g.dy > 6 && g.dy > Math.abs(g.dx);
          return Math.abs(g.dx) > 6 || Math.abs(g.dy) > 6;
        },

        onPanResponderMove: (_e, g) => {
          if (composerOpen) {
            // Card is parked at COMPOSER_RESTING_Y. Downward drag closes
            // the gap toward 0; upward drag is ignored (already at the
            // top of its lifted travel). Clamp so the card can't go below
            // its base position mid-drag.
            const liftedDy = Math.max(0, g.dy);
            position.setValue({ x: 0, y: COMPOSER_RESTING_Y + liftedDy });
            return;
          }
          // Allow horizontal movement freely; clamp downward movement so the
          // card doesn't slide off the bottom on errant downward drags.
          position.setValue({
            x: g.dx,
            y: g.dy < 0 ? g.dy : g.dy * 0.2,
          });
        },

        onPanResponderRelease: (_e, g) => {
          if (composerOpen) {
            // 60pt pull-down OR downward velocity dismisses. Otherwise
            // the card springs back up to its lifted resting position.
            if (g.dy > 60 || g.vy > 0.5) dismissComposer();
            else snapToComposerRest();
            return;
          }
          const passed =
            g.dx <= -SWIPE_X_DISTANCE || g.vx <= -SWIPE_X_VELOCITY;
          const saved =
            g.dx >= SWIPE_X_DISTANCE || g.vx >= SWIPE_X_VELOCITY;
          const upRevealed =
            g.dy <= -SWIPE_UP_DISTANCE && Math.abs(g.dx) < SWIPE_X_DISTANCE;

          if (passed) commitPass(g);
          else if (saved) commitSave(g);
          else if (upRevealed) revealComposer();
          else cancelToCenter();
        },
        onPanResponderTerminate: () => {
          if (composerOpen) snapToComposerRest();
          else cancelToCenter();
        },
      }),
    // PanResponder closes over composerOpen + current, so rebuild when those change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [composerOpen, current?.id],
  );

  // ─── Render ──────────────────────────────────────────────────────────────

  if (!current) {
    return <View style={styles.root}>{emptyState ?? <DefaultEmpty />}</View>;
  }

  return (
    <View style={styles.root}>
      {/* Card layer. The "next" peek is intentionally not rendered — design
          decision: one card visible at a time. */}
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
        <DiscoveryCard card={current} />

        {/* Edge action tints — quiet warm-tan glow when saving, muted gray
            when passing. Same Animated opacity idiom as the conditional
            scroll fades on Skills/Campus screens. */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.edgeTint,
            styles.edgeTintSave,
            { opacity: saveTintOpacity },
          ]}
        >
          <Bookmark size={28} color={Brand.seekerInk} weight="fill" />
          <Text style={styles.edgeTintLabel}>SAVE</Text>
        </Animated.View>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.edgeTint,
            styles.edgeTintPass,
            { opacity: passTintOpacity },
          ]}
        >
          <X size={28} color={Brand.inkMuted} weight="bold" />
          <Text style={[styles.edgeTintLabel, { color: Brand.inkMuted }]}>PASS</Text>
        </Animated.View>
      </Animated.View>

      {/* Composer — only renders when the card has been swiped up. Lives
          below the card; the card's translateY makes room for it. The
          `bottom` style is bound to live keyboard height so the input is
          never covered. */}
      {composerOpen && (
        <View
          style={[styles.composerWrap, { bottom: keyboardOffset }]}
          pointerEvents="box-none"
        >
          <View style={styles.composer}>
            <View style={styles.composerHeader}>
              <Text style={styles.composerTitle}>Say hi</Text>
              <Pressable
                onPress={dismissComposer}
                hitSlop={12}
                accessibilityLabel="Cancel message"
              >
                <X size={20} color={Brand.inkMuted} weight="bold" />
              </Pressable>
            </View>

            <TextInput
              value={composerText}
              onChangeText={setComposerText}
              placeholder={
                current.kind === 'seeker'
                  ? `Tell ${current.name.split(' ')[0]} what caught your eye…`
                  : `Tell ${current.ownerName.split(' ')[0]} why you'd be a good fit…`
              }
              placeholderTextColor={Brand.inkPlaceholder}
              multiline
              autoFocus
              style={styles.composerInput}
            />

            <View style={styles.composerActions}>
              <Pressable
                onPress={commitMessage}
                disabled={!composerText.trim()}
                style={({ pressed }) => [
                  styles.sendBtn,
                  !composerText.trim() && styles.sendBtnDisabled,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <PaperPlaneTilt size={16} color={Brand.inkOnBrand} weight="fill" />
                <Text style={styles.sendBtnLabel}>Send</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 2,
  },
  edgeTintLabel: {
    fontFamily: AmbitFont.body,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: Brand.seekerInk,
  },
  edgeTintSave: {
    left: 24,
    backgroundColor: Brand.seekerSurface,
    borderColor: Brand.seekerInk,
  },
  edgeTintPass: {
    right: 24,
    backgroundColor: Brand.surface1,
    borderColor: Brand.inkMuted,
  },

  // Composer — appears below the lifted card.
  composerWrap: {
    position: 'absolute',
    left: Space.lg,
    right: Space.lg,
    bottom: 0,
  },
  composer: {
    backgroundColor: Brand.canvas,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Brand.surface2,
    padding: Space.md,
    gap: 12,
    // Lift visually so it reads as a separate surface from the card.
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 4,
  },
  composerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  composerTitle: {
    fontFamily: AmbitFont.display,
    fontSize: 18,
    color: Brand.inkPrimary,
  },
  composerInput: {
    minHeight: 72,
    maxHeight: 140,
    backgroundColor: Brand.surface1,
    borderRadius: Radii.md,
    padding: 12,
    fontFamily: AmbitFont.body,
    fontSize: 15,
    color: Brand.inkBody,
    textAlignVertical: 'top',
  },
  composerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Brand.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Radii.md,
  },
  sendBtnDisabled: { opacity: 0.45 },
  sendBtnLabel: {
    fontFamily: AmbitFont.body,
    fontSize: 14,
    fontWeight: '600',
    color: Brand.inkOnBrand,
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
