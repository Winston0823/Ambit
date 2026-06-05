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
export const STRUCT_DARK = '#2A1A0C';

/// Content colors, by surface, so callers tint their own body/buttons.
export const structInk = {
  light: { title: Brand.inkPrimary, eyebrow: Brand.accent, body: Brand.inkBody, muted: Brand.inkMuted },
  dark:  { title: '#F5E9D8', eyebrow: 'rgba(245,233,216,0.7)', body: 'rgba(255,255,255,0.92)', muted: 'rgba(255,255,255,0.6)' },
};

export const structuredStyles = StyleSheet.create({
  // Light interactive surface (theirs) — matches the incoming message bubble:
  // warm fill + hairline + soft lift shadow.
  surfaceLight: {
    width: STRUCT_CARD_WIDTH,
    borderRadius: STRUCT_CARD_RADIUS,
    backgroundColor: '#F4EFE7',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60,40,20,0.06)',
    padding: 14,
    gap: 8,
    shadowColor: Brand.hearthBubbleTheirsShadow,
    shadowOpacity: 1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  // Dark surface (mine) — matches the attachment cards.
  surfaceDark: {
    width: STRUCT_CARD_WIDTH,
    borderRadius: STRUCT_CARD_RADIUS,
    backgroundColor: STRUCT_DARK,
    padding: 14,
    gap: 8,
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
