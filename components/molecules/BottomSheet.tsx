import React, { useEffect, useRef, useState } from 'react';
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
}

/// Lightweight animated bottom sheet — slides up over a fading backdrop and
/// can be flicked/dragged down to dismiss. Built on RN `Animated` +
/// `PanResponder` only (no Reanimated / no native sheet dep), so it runs in
/// Expo Go with the deps already in the project. Replaces the static
/// `Modal` + backdrop action sheets across the chat thread.
export function BottomSheet({ visible, onClose, children, hideHandle }: Props) {
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const translateY = useRef(new Animated.Value(SCREEN_H)).current;
  const backdrop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      translateY.setValue(SCREEN_H);
      // Defer one frame so the Modal has mounted before we animate in.
      requestAnimationFrame(() => {
        Animated.parallel([
          Animated.timing(backdrop, { toValue: 1, duration: 200, useNativeDriver: true }),
          Animated.spring(translateY, {
            toValue: 0,
            damping: 24,
            stiffness: 240,
            mass: 0.8,
            useNativeDriver: true,
          }),
        ]).start();
      });
    } else {
      Animated.parallel([
        Animated.timing(backdrop, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(translateY, {
          toValue: SCREEN_H,
          duration: 220,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => { if (finished) setMounted(false); });
    }
  }, [visible, backdrop, translateY]);

  const pan = useRef(
    PanResponder.create({
      // Only claim clear downward drags — taps fall through to the buttons.
      onMoveShouldSetPanResponder: (_e, g) => g.dy > 8 && g.dy > Math.abs(g.dx),
      onPanResponderMove: (_e, g) => { if (g.dy > 0) translateY.setValue(g.dy); },
      onPanResponderRelease: (_e, g) => {
        if (g.dy > 90 || g.vy > 0.8) {
          onClose();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            damping: 24,
            stiffness: 240,
            useNativeDriver: true,
          }).start();
        }
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
          style={[styles.sheet, { paddingBottom: insets.bottom + 12, transform: [{ translateY }] }]}
          {...pan.panHandlers}
        >
          {!hideHandle && <View style={styles.handle} />}
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: Brand.canvas,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
    paddingHorizontal: Space.md,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
  },
  handle: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: Brand.borderDefault,
    marginBottom: 12,
  },
});
