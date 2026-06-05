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
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unselected: {
    backgroundColor: Brand.surface1,
    borderWidth: 1.5,
    borderColor: Brand.borderDefault,
  },
  selected: {
    backgroundColor: Brand.action,
    borderWidth: 1.5,
    borderColor: Brand.actionInk,
    shadowColor: Brand.actionInk,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  label: {
    fontFamily: AmbitFont.body,
    fontSize: 14,
    fontWeight: '500',
  },
  labelOff: { color: Brand.inkBody },
  labelOn: { color: Brand.actionInk, fontWeight: '700' },
});
