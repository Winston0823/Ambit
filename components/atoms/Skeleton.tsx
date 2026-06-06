import React, { useEffect, useRef } from 'react';
import { Animated, StyleProp, ViewStyle, DimensionValue } from 'react-native';

interface Props {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

/// A skeleton placeholder block — a subtly pulsing tinted box shaped like the
/// content that's about to load. Use these instead of a spinner so the layout
/// is already in place (feels faster). Plain Animated opacity (Expo-Go safe,
/// no reanimated).
const SKELETON_TINT = 'rgba(28,28,26,0.07)'; // soft ink tint — reads on cream + eggshell

export function Skeleton({ width = '100%', height = 14, radius = 8, style }: Props) {
  const pulse = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.55, duration: 750, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: radius, backgroundColor: SKELETON_TINT, opacity: pulse },
        style,
      ]}
    />
  );
}
