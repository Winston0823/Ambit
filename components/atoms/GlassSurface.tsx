import React from 'react';
import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { BlurView } from 'expo-blur';
import { Astra } from '../../constants/theme';

interface Props {
  /// BlurView intensity. ASTRA uses 8 / 20 / 24. Defaults to 24.
  intensity?: number;
  /// Blur tint. Light glass by default.
  tint?: 'light' | 'dark' | 'default';
  /// Add a purple hairline border around the surface.
  hairline?: boolean;
  /// Overlay fill. 'light' (warm-white, default) or 'void' (dark aubergine)
  /// for dark-glass chips/badges; or pass a custom rgba string.
  fill?: 'light' | 'void' | string;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

/// ASTRA glass surface: expo-blur BlurView + a translucent warm-white fill +
/// optional purple hairline. Reusable base for glass cards, bars, and pills.
/// Phase 2 molecules layer content on top of this.
export function GlassSurface({
  intensity = 24,
  tint = 'light',
  hairline = false,
  fill = 'light',
  style,
  children,
}: Props) {
  const fillColor =
    fill === 'light' ? Astra.glassFill : fill === 'void' ? Astra.voidScrim60 : fill;
  return (
    <View style={[styles.wrap, hairline && styles.hairline, style]}>
      <BlurView intensity={intensity} tint={tint} style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: fillColor }]} pointerEvents="none" />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
  },
  fill: {
    backgroundColor: Astra.glassFill, // canvas @0.85
  },
  hairline: {
    borderWidth: 1,
    borderColor: Astra.hairlinePurple, // #6F4DA2 @0.25
  },
});
