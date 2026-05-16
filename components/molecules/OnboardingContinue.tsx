import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Brand, AmbitFont } from '../../constants/theme';

interface Props {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}

/// Primary CTA used across onboarding. 354×52, warm-tan fill, 12pt radius,
/// 17pt Plus Jakarta Regular white label + arrow.
export function OnboardingContinue({ title, onPress, disabled = false }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { opacity: disabled ? 0.45 : pressed ? 0.88 : 1 },
      ]}
    >
      <Text style={styles.label}>{title}</Text>
      <Feather name="arrow-right" size={14} color={Brand.inkOnBrand} />
    </Pressable>
  );
}

interface BackChevronProps { onPress: () => void; }
export function BackChevron({ onPress }: BackChevronProps) {
  return (
    <Pressable onPress={onPress} hitSlop={12} style={styles.chevron}>
      <Text style={styles.chevronGlyph}>‹</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: 12,
    backgroundColor: Brand.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
  },
  label: {
    fontFamily: AmbitFont.body,
    fontSize: 17,
    color: Brand.inkOnBrand,
  },
  chevron: {
    width: 32,
    height: 32,
    justifyContent: 'center',
  },
  chevronGlyph: {
    fontFamily: AmbitFont.body,
    fontSize: 28,
    color: Brand.inkMuted,
    lineHeight: 32,
  },
});
