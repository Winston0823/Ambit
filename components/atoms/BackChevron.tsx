import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Brand, AmbitFont } from '../../constants/theme';

interface Props { onPress: () => void; }

/// Self-positioning top-left back chevron. Absolute-positions itself inside
/// its parent SafeAreaView so screens never need to worry about its placement
/// — chevron glyph always sits ~24pt from the left edge and ~16pt from the
/// top of the safe area, with a 44×44 HIG-compliant touch target.
export function BackChevron({ onPress }: Props) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={styles.btn}>
      <Text style={styles.glyph}>‹</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 44,
    height: 44,
    paddingLeft: 12,
    justifyContent: 'center',
    zIndex: 10,
  },
  glyph: {
    fontFamily: AmbitFont.body,
    fontSize: 28,
    color: Brand.inkMuted,
    lineHeight: 32,
  },
});
