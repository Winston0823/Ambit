import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Brand, Space } from '../../constants/theme';

const SCREEN_H = Dimensions.get('window').height;

interface Props {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /// Hide the drag handle (e.g. for tight confirm sheets). Default false.
  hideHandle?: boolean;
  /// Opt into a fixed-height, drag-to-resize sheet with snap points (fractions
  /// of screen height, ascending — e.g. [0.5, 0.92] = half then near-top). The
  /// sheet opens at the smallest snap, drags up to the largest (capped just
  /// below the Dynamic Island), and dismisses when flicked/dragged below the
  /// smallest. Omit for the legacy content-sized, drag-to-dismiss sheet.
  snapPoints?: number[];
}

/// Animated bottom sheet on RN `Animated` + `PanResponder` (no Reanimated /
/// native-sheet dep, so it runs in Expo Go). PanResponder — not
/// gesture-handler — because gesture-handler gestures are unreliable inside an
/// RN `Modal`, which this uses. With `snapPoints` it becomes a true
/// drag-to-expand sheet; without, it's the legacy content-sized sheet.
export function BottomSheet({ visible, onClose, children, hideHandle, snapPoints }: Props) {
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const translateY = useRef(new Animated.Value(SCREEN_H)).current;
  const backdrop = useRef(new Animated.Value(0)).current;

  // Resolve snap points → pixel heights + translateY offsets (0 = tallest).
  const snap = useMemo(() => {
    if (!snapPoints || snapPoints.length === 0) return null;
    const cap = SCREEN_H - insets.top - 10; // never cover the Dynamic Island
    const heights = [...snapPoints].map((f) => Math.min(f * SCREEN_H, cap)).sort((a, b) => a - b);
    const maxH = heights[heights.length - 1];
    return {
      maxH,
      offsets: heights.map((h) => maxH - h), // [collapsed … expanded(0)]
      open: maxH - heights[0],               // smallest snap
      expanded: 0,
      dismiss: maxH,
    };
  }, [snapPoints, insets.top]);

  // Resting translateY between drags (so a drag is relative to the last snap).
  const restOffset = useRef(0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      const start = snap ? snap.dismiss : SCREEN_H;
      const open = snap ? snap.open : 0;
      translateY.setValue(start);
      requestAnimationFrame(() => {
        restOffset.current = open;
        Animated.parallel([
          Animated.timing(backdrop, { toValue: 1, duration: 200, useNativeDriver: true }),
          // JS driver — translateY is also driven by PanResponder.setValue(),
          // and you can't mix native + setValue on one Animated.Value.
          Animated.spring(translateY, { toValue: open, damping: 24, stiffness: 240, mass: 0.8, useNativeDriver: false }),
        ]).start();
      });
    } else {
      Animated.parallel([
        Animated.timing(backdrop, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(translateY, {
          toValue: snap ? snap.dismiss : SCREEN_H,
          duration: 220,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: false,
        }),
      ]).start(({ finished }) => { if (finished) setMounted(false); });
    }
    // Only on open/close — NOT on `snap` identity. A consumer passing an
    // inline snapPoints array makes `snap` a new object every render; re-running
    // here would re-animate the sheet on every keystroke. `snap` is read from
    // the current render's closure, which is correct when `visible` flips.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const settle = (offset: number) => {
    restOffset.current = offset;
    Animated.spring(translateY, { toValue: offset, damping: 24, stiffness: 240, useNativeDriver: false }).start();
  };

  // Read the latest snap config + onClose inside the (stable) pan handlers so
  // they never go stale (insets resolve after first render).
  const snapRef = useRef(snap); snapRef.current = snap;
  const onCloseRef = useRef(onClose); onCloseRef.current = onClose;

  const pan = useRef(
    PanResponder.create({
      // Inside an RN <Modal>, onMoveShouldSet* often never fires — so in snap
      // mode (pan is on the grab strip, which has NO tappable children) we
      // claim on START, which is reliable. Legacy mode (pan on the whole sheet
      // with buttons) stays move-only so taps still work.
      onStartShouldSetPanResponder: () => !!snapRef.current,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 3 && Math.abs(g.dy) >= Math.abs(g.dx),
      onMoveShouldSetPanResponderCapture: (_e, g) => Math.abs(g.dy) > 3 && Math.abs(g.dy) >= Math.abs(g.dx),
      onPanResponderTerminationRequest: () => false,
      // Capture the live position so the drag is relative (handles mid-spring).
      onPanResponderGrant: () => { translateY.stopAnimation((v: number) => { restOffset.current = v; }); },
      onPanResponderMove: (_e, g) => {
        const s = snapRef.current;
        const next = restOffset.current + g.dy;
        const max = s ? s.dismiss : SCREEN_H;
        translateY.setValue(Math.max(0, Math.min(max, next)));
      },
      onPanResponderRelease: (_e, g) => {
        const s = snapRef.current;
        if (!s) {
          if (g.dy > 90 || g.vy > 0.8) onCloseRef.current();
          else settle(0);
          return;
        }
        const landed = restOffset.current + g.dy + g.vy * 80; // velocity bias
        const targets = [...s.offsets, s.dismiss];
        let nearest = targets.reduce((p, c) => (Math.abs(c - landed) < Math.abs(p - landed) ? c : p), targets[0]);
        if (g.vy > 1.2 && restOffset.current >= s.open - 1) nearest = s.dismiss;
        if (nearest === s.dismiss) onCloseRef.current();
        else settle(nearest);
      },
    }),
  ).current;

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, { opacity: backdrop }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Dismiss" />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            { paddingBottom: insets.bottom + 12, transform: [{ translateY }] },
            snap && { height: snap.maxH },
          ]}
          // Legacy: whole sheet drags. Snap: only the handle zone drags (so a
          // scroll view in the content scrolls freely).
          {...(snap ? {} : pan.panHandlers)}
        >
          <View {...(snap ? pan.panHandlers : {})} style={snap ? styles.grabZone : undefined}>
            {!hideHandle && <View style={styles.handle} />}
          </View>
          {snap ? <View style={styles.snapBody}>{children}</View> : children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: Brand.canvas,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: Space.md,
    // Bottom-anchored sheet: crisp ink edge instead of a soft shadow.
    borderWidth: 1.5,
    borderBottomWidth: 0,
    borderColor: Brand.inkEdge,
  },
  // Generous grab strip at the top — the whole zone (not just the 4px notch)
  // is draggable so the sheet is easy to resize.
  grabZone: { paddingTop: 12, paddingBottom: 16, marginHorizontal: -Space.md, alignItems: 'center' },
  snapBody: { flex: 1 },
  handle: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: Brand.borderDefault,
    marginBottom: 12,
  },
});
