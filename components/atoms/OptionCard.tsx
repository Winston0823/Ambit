import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Brand, Radii, AmbitFont } from '../../constants/theme';

export type OptionCardVariant = 'neutral' | 'seeker';

interface Props {
  title: string;
  subtitle: string;
  variant?: OptionCardVariant;
  selected?: boolean;
  onPress?: () => void;
}

/// Option card used in role-declaration etc.
/// Default state:
///   neutral → surface2 fill, ink-high title, ink-muted subtitle
///   seeker  → seekerSurface fill, seekerInk title, accent subtitle
/// Selected state: warm-tan fill, white ink (matches Figma yellow tint = selection).
export function OptionCard({
  title,
  subtitle,
  variant = 'neutral',
  selected = false,
  onPress,
}: Props) {
  const seeker = variant === 'seeker';

  let bg: string = seeker ? Brand.seekerSurface : Brand.surface2;
  let titleColor: string = seeker ? Brand.seekerInk : Brand.inkHigh;
  let subColor: string = seeker ? Brand.accent : Brand.inkMuted;

  if (selected) {
    bg = Brand.primary;
    titleColor = Brand.inkOnBrand;
    subColor = 'rgba(255,255,255,0.88)';
  }

  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, { backgroundColor: bg }]}
    >
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
