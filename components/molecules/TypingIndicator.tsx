import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { AmbitFont, Brand, Radii } from '../../constants/theme';

interface Props {
  name?: string;
}

/// Three-dot typing indicator. Each dot bobs on a 600ms loop with a
/// 150ms phase offset; the bubble stays the same width as a smallish
/// message bubble so the list doesn't jump when it appears.
export function TypingIndicator({ name }: Props) {
  const d1 = useRef(new Animated.Value(0)).current;
  const d2 = useRef(new Animated.Value(0)).current;
  const d3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const make = (val: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(val, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]),
      );
    const loops = [make(d1, 0), make(d2, 150), make(d3, 300)];
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [d1, d2, d3]);

  const dotStyle = (v: Animated.Value) => ({
    transform: [
      {
        translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }),
      },
    ],
    opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
  });

  return (
    <View style={styles.row}>
      <View style={styles.bubble}>
        <Animated.View style={[styles.dot, dotStyle(d1)]} />
        <Animated.View style={[styles.dot, dotStyle(d2)]} />
        <Animated.View style={[styles.dot, dotStyle(d3)]} />
      </View>
      {name ? <Text style={styles.label}>{name} is typing…</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Brand.surface1,
    borderRadius: Radii.lg,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Brand.inkMuted,
  },
  label: {
    fontFamily: AmbitFont.body,
    fontSize: 11,
    color: Brand.inkMuted,
  },
});
