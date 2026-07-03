import React from 'react';
import { View, ViewStyle, StyleProp } from 'react-native';

interface Props {
  children: React.ReactNode;
  /// Kept for API compatibility (was the block's corner radius). Unused now
  /// that the shadow is a soft RN elevation rather than a solid offset block.
  radius?: number;
  /// Vertical shadow offset (px). Drives shadowOffset.height / a soft lift.
  offset?: number;
  /// Shadow color. Defaults to a royal-tinted lift for the ASTRA look.
  color?: string;
  style?: StyleProp<ViewStyle>;
}

/// ASTRA soft elevation. Repurposed from the old hard-offset block into a
/// subtle floating shadow so buttons/cards lift gently off the warm canvas.
/// Same props as before ({children, radius, offset, color, style}) so all
/// existing call sites keep compiling — it just renders soft now.
///
///   <HardShadow radius={4} offset={6}>
///     <Pressable style={royal-button}>…</Pressable>
///   </HardShadow>
export function HardShadow({ children, offset = 6, color = '#2D005E', style }: Props) {
  return (
    <View
      style={[
        {
          shadowColor: color,
          shadowOffset: { width: 0, height: offset },
          shadowRadius: 18,
          shadowOpacity: 0.14,
          elevation: 6,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
