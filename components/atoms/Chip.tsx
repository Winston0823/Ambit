import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Brand, Radii, AmbitFont } from '../../constants/theme';

interface Props {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}

/// Skill chip / pill. Spec § design tokens — Pill chip.
/// Default: surface1 fill + 1.5px border + ink-body text
/// Selected: warm-tan fill + no border + white text
export function Chip({ label, selected = false, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.base, selected ? styles.selected : styles.unselected]}
    >
      <Text style={[styles.label, selected ? styles.labelOn : styles.labelOff]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 36,
    paddingHorizontal: 14,
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
    backgroundColor: Brand.primary,
  },
  label: {
    fontFamily: AmbitFont.body,
    fontSize: 13,
  },
  labelOff: { color: Brand.inkBody },
  labelOn: { color: Brand.inkOnBrand },
});
