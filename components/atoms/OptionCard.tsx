import React, { useRef } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Brand, Radii, AmbitFont } from '../../constants/theme';

interface Props {
  title: string;
  subtitle: string;
  selected?: boolean;
  onPress?: () => void;
}

/// Role-selection option card.
/// - Unselected: neutral grey surface, ink-high title, ink-muted subtitle.
/// - Selected:   "Project Seeker" visual — seekerSurface fill, seekerInk title,
///               accent subtitle. (Per Figma: the seeker example *is* the
///               selected-state preview for any option.)
///
/// On tap: selection haptic + a brief scale pulse (0.97 → 1.02 → 1) so the
/// selection reads as a tactile event, not an instant state swap.
export function OptionCard({ title, subtitle, selected = false, onPress }: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const press = () => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 0.97,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 4,
        tension: 200,
        useNativeDriver: true,
      }),
    ]).start();
    onPress?.();
  };

  const bg: string = selected ? Brand.seekerSurface : Brand.surface2;
  const titleColor: string = selected ? Brand.seekerInk : Brand.inkHigh;
  const subColor: string = selected ? Brand.accent : Brand.inkMuted;

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable onPress={press} style={[styles.card, { backgroundColor: bg }]}>
        <Text style={[styles.title, { color: titleColor }]}>{title}</Text>
        <Text style={[styles.subtitle, { color: subColor }]}>{subtitle}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 104,
    borderRadius: Radii.lg,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  title: {
    fontFamily: AmbitFont.body,
    fontSize: 16,
    fontWeight: '600',
  },
  subtitle: {
    fontFamily: AmbitFont.body,
    fontSize: 13,
    marginTop: 4,
    lineHeight: 19,
  },
});
