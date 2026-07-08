import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { Brand } from '../../constants/theme';
import { Motion } from '../../constants/motion';
import { haptics } from '../../lib/haptics';
import { useReducedMotion } from '../../hooks/useReducedMotion';

interface Props {
  /// Increment this to fire the celebration (e.g. on match / confirmed / hired).
  /// The burst is skipped on first mount so existing state doesn't celebrate.
  trigger: number;
  /// Ring color — defaults to the warm-tan brand.
  color?: string;
  size?: number;
}

/// A restrained, on-brand "earned moment": a soft warm ring blooms outward and
/// fades, paired with a success haptic. Ambit's calm answer to Duolingo's
/// confetti — delight without the cartoon. Drop it into a `position:relative`
/// parent (it centers itself) and bump `trigger` at the emotional beat.
export function Celebrate({ trigger, color = Brand.primary, size = 64 }: Props) {
  const a = useRef(new Animated.Value(0)).current;
  const mounted = useRef(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    // Skip the initial render so we only celebrate real transitions.
    if (!mounted.current) { mounted.current = true; return; }
    haptics.success();
    // Reduced motion: keep the haptic beat but skip the expanding-ring bloom.
    // Final state is opacity 0 (the ring self-hides), so leave `a` at rest.
    if (reduceMotion) { a.setValue(0); return; }
    a.setValue(0);
    Animated.timing(a, { toValue: 1, duration: 640, easing: Motion.easeOutExpo, useNativeDriver: true }).start();
  }, [trigger, a, reduceMotion]);

  const scale = a.interpolate({ inputRange: [0, 1], outputRange: [0.3, 2.6] });
  const opacity = a.interpolate({ inputRange: [0, 0.12, 1], outputRange: [0, 0.55, 0] });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ring,
        { width: size, height: size, borderRadius: size / 2, marginLeft: -size / 2, marginTop: -size / 2, borderColor: color, opacity, transform: [{ scale }] },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  ring: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    borderWidth: 3,
  },
});
