import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Spacing, Radii } from '../../constants/theme';

interface TagProps {
  label: string;
}

export function Tag({ label }: TagProps) {
  return (
    <View style={styles.tag}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    backgroundColor: Colors.warmGray,
    paddingHorizontal: Spacing.sm + 4,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radii.tag,
  },
  text: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
});
