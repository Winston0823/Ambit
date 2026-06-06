import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AmbitFont, Brand } from '../../constants/theme';

/// Shared design language for "structured message" cards in chat — the media
/// previews (project / portfolio attachments) and the interactive widgets
/// (scheduling / availability poll). They aren't the same component (one is a
/// dark image-backdrop preview, the other a light actionable surface), but
/// they share geometry, the eyebrow→serif-title header, surfaces, and palette
/// so every rich message reads as one family.

export const STRUCT_CARD_WIDTH = 268;
export const STRUCT_CARD_RADIUS = 22;
/// Warm dark surface — same as the project/portfolio attachment cards.
/// Structured cards are now LIGHT cream on the eggshell canvas (was warm-dark).
export const STRUCT_DARK = '#FBFAF5';

/// Content colors, by surface. Both surfaces are light now, so both use dark
/// ink with a teal eyebrow accent.
export const structInk = {
  light: { title: Brand.inkPrimary, eyebrow: '#6E9CA1', body: Brand.inkBody, muted: Brand.inkMuted },
  dark:  { title: Brand.inkPrimary, eyebrow: '#6E9CA1', body: Brand.inkBody, muted: Brand.inkMuted },
};

export const structuredStyles = StyleSheet.create({
  // Light interactive surface (theirs) — matches the incoming message bubble:
  // warm fill + hairline + soft lift shadow.
  surfaceLight: {
    width: STRUCT_CARD_WIDTH,
    borderRadius: STRUCT_CARD_RADIUS,
    backgroundColor: Brand.cardCream,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(28,28,26,0.08)',
    padding: 14,
    gap: 8,
    shadowColor: Brand.hearthBubbleTheirsShadow,
    shadowOpacity: 1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  // Both surfaces are light cream now — same crafted card look.
  surfaceDark: {
    width: STRUCT_CARD_WIDTH,
    borderRadius: STRUCT_CARD_RADIUS,
    backgroundColor: Brand.cardCream,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(28,28,26,0.08)',
    padding: 14,
    gap: 8,
    shadowColor: Brand.hearthBubbleTheirsShadow,
    shadowOpacity: 1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  eyebrow: {
    fontFamily: AmbitFont.body,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: AmbitFont.display,
    fontSize: 18,
    lineHeight: 23,
    letterSpacing: -0.2,
  },
  headerWrap: { gap: 3 },
});

/// Eyebrow (category) + serif title — the shared header for every structured
/// card. `dark` flips the palette for the dark surface.
export function StructuredHeader({
  label,
  title,
  dark = false,
}: {
  label: string;
  title: string;
  dark?: boolean;
}) {
  const ink = dark ? structInk.dark : structInk.light;
  return (
    <View style={structuredStyles.headerWrap}>
      <Text style={[structuredStyles.eyebrow, { color: ink.eyebrow }]} numberOfLines={1}>{label}</Text>
      <Text style={[structuredStyles.title, { color: ink.title }]} numberOfLines={2}>{title}</Text>
    </View>
  );
}
