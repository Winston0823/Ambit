import React from 'react';
import { View, ViewStyle, StyleProp } from 'react-native';
import { Brand } from '../../constants/theme';

interface Props {
  children: React.ReactNode;
  /// Match the child's border radius so the block's bottom curve aligns.
  radius?: number;
  /// How far the solid block peeks below the child (the "hard shadow" depth).
  offset?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

/// Crisp "hard shadow" — a solid color block offset behind the child, reliable
/// where RN's `shadowRadius: 0` renders blurry or leaves a seam against a
/// border. The child must be opaque (it covers the block's top half).
///
///   <HardShadow radius={999} offset={4}>
///     <Pressable style={teal-pill-with-ink-border}>…</Pressable>
///   </HardShadow>
export function HardShadow({ children, radius = 999, offset = 4, color = Brand.actionInk, style }: Props) {
  return (
    <View style={style}>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: offset,
          bottom: -offset,
          borderRadius: radius,
          backgroundColor: color,
        }}
      />
      {children}
    </View>
  );
}
