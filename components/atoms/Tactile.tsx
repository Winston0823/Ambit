import React, { useRef } from 'react';
import { Animated, Pressable } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { Motion } from '../../constants/motion';
import { haptics, type HapticKind } from '../../lib/haptics';

interface Props {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  /// Which haptic fires on a confirmed press. 'none' to silence.
  haptic?: HapticKind | 'none';
  /// Press-in compression target (default the shared press scale).
  scaleTo?: number;
  style?: StyleProp<ViewStyle>;
  hitSlop?: number;
  accessibilityLabel?: string;
}

/// Universal tactile press: compresses on press-in and springs back, with a
/// haptic on confirmed press — the same feel as the `Button` atom, for any
/// card / tile / icon-button that isn't a text CTA. Native-driver throughout.
export function Tactile({
  children,
  onPress,
  onLongPress,
  disabled = false,
  haptic = 'tap',
  scaleTo = Motion.press.scale,
  style,
  hitSlop,
  accessibilityLabel,
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const press = () => {
    if (disabled) return;
    if (haptic !== 'none') haptics[haptic]();
    onPress?.();
  };

  return (
    // Wrapper carries only the transform (mirrors the Button atom); the box
    // `style` goes on the Pressable so it fills + keeps a full tap target.
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={press}
        onLongPress={onLongPress}
        disabled={disabled}
        hitSlop={hitSlop}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={style}
        onPressIn={() => Animated.spring(scale, { toValue: scaleTo, ...Motion.press.in, useNativeDriver: true }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, ...Motion.press.out, useNativeDriver: true }).start()}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
