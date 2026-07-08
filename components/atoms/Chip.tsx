import React, { useRef } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Brand, Radii, AmbitFont } from '../../constants/theme';

interface Props {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}

/// Skill chip / pill. Spec § design tokens — Pill chip.
/// Default: surface1 fill + 1.5px border + ink-body text
/// Selected: warm-tan fill + no border + white text
/// Tap: selection haptic + brief scale pulse.
export function Chip({ label, selected = false, onPress }: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const press = () => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.94, duration: 70, useNativeDriver: true }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 4,
        tension: 220,
        useNativeDriver: true,
      }),
    ]).start();
    onPress?.();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={press}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        // 40px visual height + 2px top/bottom → 44pt effective touch target.
        hitSlop={{ top: 2, bottom: 2 }}
        style={[styles.base, selected ? styles.selected : styles.unselected]}
      >
        <Text style={[styles.label, selected ? styles.labelOn : styles.labelOff]}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: Radii.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unselected: {
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(111,77,162,0.28)',
  },
  selected: {
    backgroundColor: Brand.selected,
  },
  label: {
    fontFamily: AmbitFont.medium,
    fontSize: 14,
  },
  labelOff: { color: Brand.accent },
  labelOn: { color: Brand.inkOnBrand, fontFamily: AmbitFont.semibold },
});
