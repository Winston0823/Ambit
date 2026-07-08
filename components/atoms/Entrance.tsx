import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { Motion } from '../../constants/motion';
import { useReducedMotion } from '../../hooks/useReducedMotion';

interface Props {
  children: React.ReactNode;
  /// Stagger position. Each item rises in at `index * step` ms after mount,
  /// so wrapping a column of elements with incrementing indices makes the
  /// content "assemble" top-to-bottom instead of snapping in at once.
  index?: number;
  /// Per-index delay in ms.
  step?: number;
  /// Distance (px) the content rises from.
  offset?: number;
  style?: StyleProp<ViewStyle>;
}

/// Lightweight mount-entrance wrapper: fades + rises its children on mount.
/// Native-driver (opacity + translateY) so it stays smooth alongside the
/// screen-level slide transition. Respects the OS "Reduce Motion" setting —
/// when on, content simply appears with no movement.
export function Entrance({ children, index = 0, step = Motion.stagger, offset = 14, style }: Props) {
  const t = useRef(new Animated.Value(0)).current;
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) {
      t.setValue(1);
      return;
    }
    const anim = Animated.timing(t, {
      toValue: 1,
      ...Motion.timing,
      delay: index * step,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [t, index, step, reduceMotion]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: t,
          transform: [
            { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [offset, 0] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
