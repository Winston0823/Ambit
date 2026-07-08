import React from 'react';
import { StyleSheet, Text, View, ViewStyle, StyleProp } from 'react-native';
import { GlassSurface } from './GlassSurface';
import { AmbitFont, Brand } from '../../constants/theme';

interface Props {
  /// Optional node docked to the left of the wordmark (e.g. a back caret on
  /// pushed screens).
  left?: React.ReactNode;
  /// Optional node docked to the right (icon button, action, etc.).
  right?: React.ReactNode;
  /// Wordmark text. Defaults to the "ambit" lockup.
  title?: string;
  style?: StyleProp<ViewStyle>;
}

/// ASTRA glass top bar: the "ambit" wordmark (Playfair) on the left with an
/// optional right-slot node. Sits on a light-glass surface with a bottom
/// hairline. Screens (Phase 2) wrap it in their own safe-area handling.
export function TopAppBar({ left, right, title = 'ambit', style }: Props) {
  return (
    <GlassSurface intensity={24} tint="light" style={[styles.bar, style]}>
      <View style={styles.row}>
        <View style={styles.leftGroup}>
          {left}
          <Text style={styles.wordmark}>{title}</Text>
        </View>
        <View style={styles.right}>{right}</View>
      </View>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(204,195,210,0.4)', // lilac hairline @0.4
  },
  row: {
    height: 52,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  wordmark: {
    fontFamily: AmbitFont.display,
    fontSize: 24,
    color: Brand.inkPrimary,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
