import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Brand, AmbitFont } from '../../constants/theme';

interface Props { onPress: () => void; }

/// Back chevron glyph. Spec § design tokens — `‹` 28px ink-muted, x=24 y=70.
export function BackChevron({ onPress }: Props) {
  return (
    <Pressable onPress={onPress} hitSlop={12} style={styles.btn}>
      <Text style={styles.glyph}>‹</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
  },
  glyph: {
    fontFamily: AmbitFont.body,
    fontSize: 28,
    color: Brand.inkMuted,
    lineHeight: 32,
  },
});
