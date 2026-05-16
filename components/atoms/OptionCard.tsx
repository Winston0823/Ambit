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

/// Option card used in role-declaration, campus, etc.
/// Spec § design tokens — Role declaration card (354×104, radius 16, 20pt inner padding).
export function OptionCard({
  title,
  subtitle,
  variant = 'neutral',
  selected = false,
  onPress,
}: Props) {
  const seeker = variant === 'seeker';
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.card,
        seeker ? styles.seekerBg : styles.neutralBg,
        selected && styles.selected,
      ]}
    >
      <Text
        style={[
          styles.title,
          { color: seeker ? Brand.seekerInk : Brand.inkHigh },
        ]}
      >
        {title}
      </Text>
      <Text
        style={[
          styles.subtitle,
          { color: seeker ? Brand.accent : Brand.inkMuted },
        ]}
      >
        {subtitle}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 104,
    borderRadius: Radii.lg,
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  neutralBg: { backgroundColor: Brand.surface2 },
  seekerBg:  { backgroundColor: Brand.seekerSurface },
  selected:  { borderColor: Brand.accent },
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
