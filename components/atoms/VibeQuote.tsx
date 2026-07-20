import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Brand } from '../../constants/theme';

interface Props {
  text: string;
  /// Max lines before ellipsis. Card faces are fixed-height, so cap it.
  lines?: number;
  /// 'card' = discovery card faces (larger); 'inline' = profile cards.
  size?: 'card' | 'inline';
}

/// The person's voice, in the app's signature vibe treatment: italic serif
/// with an oversized translucent iris quote glyph. Mirrors the treatment the
/// attachment bubbles use on dark, tuned for light surfaces. The vibe blurb
/// drives matching (vibe_embedding) — visually it should read as the soul of
/// the card, not a caption.
export function VibeQuote({ text, lines = 3, size = 'card' }: Props) {
  if (!text.trim()) return null;
  return (
    <View style={styles.block}>
      <Text style={styles.glyph} allowFontScaling={false} numberOfLines={1} pointerEvents="none">
        {'“'}
      </Text>
      <Text style={[styles.quote, size === 'inline' && styles.quoteInline]} numberOfLines={lines}>
        {text}
      </Text>
    </View>
  );
}

const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });

const styles = StyleSheet.create({
  block: { position: 'relative', paddingTop: 4, paddingLeft: 14 },
  glyph: {
    position: 'absolute',
    top: -20,
    left: -6,
    fontSize: 58,
    fontFamily: SERIF,
    fontStyle: 'italic',
    color: 'rgba(153, 117, 206, 0.38)',
    includeFontPadding: false,
    zIndex: 0,
  },
  quote: {
    position: 'relative',
    zIndex: 1,
    fontFamily: SERIF,
    fontStyle: 'italic',
    fontSize: 16,
    lineHeight: 23,
    letterSpacing: -0.1,
    color: Brand.inkPrimary,
  },
  quoteInline: {
    fontSize: 15,
    lineHeight: 22,
    color: Brand.inkBody,
  },
});
