import React from 'react';
import { Pressable, StyleSheet, Text, ViewStyle, TextStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Brand, Radii, AmbitFont } from '../../constants/theme';

type Variant = 'primary' | 'secondary' | 'ghost';

interface Props {
  title: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  trailingArrow?: boolean;
  style?: ViewStyle;
}

/// Primary CTA: warm-tan fill, white label, 12pt radius, optional arrow.
/// Spec § design tokens — Onboarding Continue button.
export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  trailingArrow = false,
  style,
}: Props) {
  const tones = TONES[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        tones.container,
        { opacity: disabled ? 0.45 : pressed ? 0.88 : 1 },
        style,
      ]}
    >
      <Text style={[styles.label, tones.label]}>{title}</Text>
      {trailingArrow && (
        <Feather name="arrow-right" size={14} color={tones.label.color as string} />
      )}
    </Pressable>
  );
}

const TONES: Record<Variant, { container: ViewStyle; label: TextStyle }> = {
  primary: {
    container: { backgroundColor: Brand.primary },
    label: { color: Brand.inkOnBrand },
  },
  secondary: {
    container: {
      backgroundColor: Brand.surface1,
      borderWidth: 1.5,
      borderColor: Brand.borderDefault,
    },
    label: { color: Brand.inkPrimary },
  },
  ghost: {
    container: { backgroundColor: 'transparent' },
    label: { color: Brand.accent },
  },
};

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: Radii.md,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  label: {
    fontFamily: AmbitFont.body,
    fontSize: 17,
  },
});
