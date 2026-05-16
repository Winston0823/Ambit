import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors, Spacing } from '../../constants/theme';

interface DividerProps {
  spacing?: number;
}

export function Divider({ spacing = Spacing.md }: DividerProps) {
  return <View style={[styles.divider, { marginVertical: spacing }]} />;
}

const styles = StyleSheet.create({
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
  },
});
