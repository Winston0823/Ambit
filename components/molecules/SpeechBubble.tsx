import React, { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { Brand, Radii, Space } from '../../constants/theme';

interface Props {
  children: ReactNode;
  /// Fill color of the bubble + tail. Defaults to warm seekerSurface.
  color?: string;
  /// Where the tail anchors on the bubble's top edge.
  /// 'top-left' (default) points up-and-toward the avatar that sits above-left.
  tailAnchor?: 'top-left' | 'top-right' | 'none';
  /// Horizontal offset in pt from the anchored edge for fine-tuning under
  /// avatars of different sizes. Defaults to 20.
  tailOffset?: number;
  /// Optional style overrides for the bubble container.
  style?: ViewStyle;
}

/// Speech bubble with an upward-pointing tail at a configurable corner.
///
/// Tail is drawn with the classic React Native triangle trick — a 0×0 view
/// with three solid borders. Cheap, no SVG, no clipsContent issues.
///
/// Usage:
///   <SpeechBubble color={Brand.seekerSurface} tailAnchor="top-left">
///     <Text>...</Text>
///   </SpeechBubble>
export function SpeechBubble({
  children,
  color = Brand.seekerSurface,
  tailAnchor = 'top-left',
  tailOffset = 20,
  style,
}: Props) {
  return (
    <View style={styles.wrap}>
      {tailAnchor !== 'none' && (
        <View
          style={[
            styles.tail,
            { borderBottomColor: color },
            tailAnchor === 'top-left'
              ? { left: tailOffset }
              : { right: tailOffset },
          ]}
        />
      )}
      <View style={[styles.bubble, { backgroundColor: color }, style]}>
        {children}
      </View>
    </View>
  );
}

const TAIL_SIZE = 11; // half-width of the tail; full base = 22pt

const styles = StyleSheet.create({
  // The wrap is just a positioning context for the absolutely-positioned tail.
  wrap: {
    position: 'relative',
  },
  bubble: {
    borderRadius: Radii.lg + 2,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  tail: {
    position: 'absolute',
    top: -TAIL_SIZE,
    width: 0,
    height: 0,
    borderLeftWidth: TAIL_SIZE,
    borderRightWidth: TAIL_SIZE,
    borderBottomWidth: TAIL_SIZE,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    // Sit above the bubble — bottom border supplies the visible color.
  },
});
