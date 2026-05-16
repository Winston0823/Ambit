import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
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
export function OptionCard({ title, subtitle, selected = false, onPress }: Props) {
  const bg: string = selected ? Brand.seekerSurface : Brand.surface2;
  const titleColor: string = selected ? Brand.seekerInk : Brand.inkHigh;
  const subColor: string = selected ? Brand.accent : Brand.inkMuted;

  return (
    <Pressable onPress={onPress} style={[styles.card, { backgroundColor: bg }]}>
      <Text style={[styles.title, { color: titleColor }]}>{title}</Text>
      <Text style={[styles.subtitle, { color: subColor }]}>{subtitle}</Text>
    </Pressable>
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
