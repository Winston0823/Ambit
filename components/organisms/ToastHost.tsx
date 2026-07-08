/// ToastHost — the single mounted renderer for the global toast bus
/// (lib/toast.ts). Mount ONCE near the app root, above both onboarding and
/// the main app, so any layer's `toast.error(...)` surfaces consistently.
///
/// House style: RN Animated (no reanimated), eggshell/ink tokens, the
/// signature tactile ink edge on the action button. Stacks bottom-up and
/// auto-dismisses per item.

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckCircle, Warning, Info } from 'phosphor-react-native';
import { toast, ToastItem, ToastTone } from '../../lib/toast';
import { Brand, AmbitFont, Radii, Space } from '../../constants/theme';
import { useReducedMotion } from '../../hooks/useReducedMotion';

const TONE: Record<
  ToastTone,
  { bg: string; ink: string; Icon: typeof Info }
> = {
  error:   { bg: '#FBECEA', ink: Brand.danger,     Icon: Warning },
  success: { bg: Brand.tagMint, ink: Brand.tagMintInk, Icon: CheckCircle },
  info:    { bg: Brand.cardCream, ink: Brand.inkBody, Icon: Info },
};

function ToastRow({ item, onClose }: { item: ToastItem; onClose: (id: number) => void }) {
  const reduceMotion = useReducedMotion();
  // When reduced motion is on the toast sits still (no rise) and fades only.
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(reduceMotion ? 0 : 12)).current;

  const dismiss = useCallback(() => {
    const anims = [Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true })];
    if (!reduceMotion) {
      anims.push(Animated.timing(translateY, { toValue: 12, duration: 180, useNativeDriver: true }));
    }
    Animated.parallel(anims).start(() => onClose(item.id));
  }, [item.id, onClose, opacity, translateY, reduceMotion]);

  useEffect(() => {
    // Announce for screen readers (covers Android + queued toasts, where the
    // live-region role alone isn't reliably re-read).
    AccessibilityInfo.announceForAccessibility(item.message);
  }, [item.message]);

  useEffect(() => {
    if (reduceMotion) {
      translateY.setValue(0);
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, friction: 8, tension: 80, useNativeDriver: true }),
      ]).start();
    }
    if (item.durationMs > 0) {
      const t = setTimeout(dismiss, item.durationMs);
      return () => clearTimeout(t);
    }
  }, [dismiss, item.durationMs, opacity, translateY, reduceMotion]);

  const tone = TONE[item.tone];
  const Icon = tone.Icon;

  return (
    <Animated.View
      style={[styles.row, { backgroundColor: tone.bg, opacity, transform: [{ translateY }] }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Icon size={20} color={tone.ink} weight="fill" />
      <Text style={[styles.message, { color: Brand.inkBody }]} numberOfLines={3}>
        {item.message}
      </Text>
      {item.actionLabel ? (
        <Pressable
          onPress={() => { item.onAction?.(); dismiss(); }}
          accessibilityRole="button"
          accessibilityLabel={item.actionLabel}
          hitSlop={8}
          style={({ pressed }) => [styles.action, pressed && { opacity: 0.7 }]}
        >
          <Text style={[styles.actionLabel, { color: tone.ink }]}>{item.actionLabel}</Text>
        </Pressable>
      ) : (
        <Pressable
          onPress={dismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          // ✕ glyph is ~14pt; pad out to a ≥44pt effective touch target.
          hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
        >
          <Text style={[styles.dismiss, { color: Brand.inkMuted }]}>✕</Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

export function ToastHost() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    return toast.subscribe((item) => {
      // Cap the stack so a burst of failures can't bury the screen.
      setItems((prev) => [...prev.slice(-2), item]);
    });
  }, []);

  const remove = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  if (items.length === 0) return null;

  return (
    <View
      style={[styles.host, { bottom: insets.bottom + Space.lg }]}
      pointerEvents="box-none"
    >
      {items.map((item) => (
        <ToastRow key={item.id} item={item} onClose={remove} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: Space.md,
    right: Space.md,
    gap: Space.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    paddingVertical: 12,
    paddingHorizontal: Space.md,
    borderRadius: Radii.lg,
    borderWidth: 1.5,
    borderColor: Brand.inkEdge,
    // Signature hard offset edge (matches the tactile button language).
    shadowColor: Brand.inkEdge,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  message: {
    flex: 1,
    fontFamily: AmbitFont.body,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 19,
  },
  action: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  actionLabel: {
    fontFamily: AmbitFont.body,
    fontSize: 14,
    fontWeight: '700',
  },
  dismiss: {
    fontFamily: AmbitFont.body,
    fontSize: 14,
    fontWeight: '700',
    paddingHorizontal: 4,
  },
});
