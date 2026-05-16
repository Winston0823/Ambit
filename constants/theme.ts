import { Platform, TextStyle, ViewStyle } from 'react-native';

export const Colors = {
  brandGreen: '#1A6B4F',
  warmWhite: '#FAFAF7',
  warmGray: '#F3F2EE',
  textPrimary: '#1A1A2E',
  textSecondary: '#6B6B6B',
  textTertiary: '#9B9B9B',
  coral: '#D85A30',
  softBlue: '#2563EB',
  successGreen: '#16A34A',
  white: '#FFFFFF',
  black: '#000000',
  border: '#E5E5E0',
  badgeGreen: '#E8F5F0',
  badgeGray: '#EEEDEA',
  badgeCoral: '#FDEEE8',
  badgeBlue: '#EBF2FF',
  overlay: 'rgba(0,0,0,0.4)',
} as const;

export const Brand = {
  primary: '#D4B490',
  accent: '#B48045',
  seekerSurface: '#F2E8DD',
  seekerTitleInk: '#4D361D',
  canvas: '#FFFFFF',
  surface1: '#F6F6F6',
  surface2: '#EFEFEF',
  borderDefault: '#E0E0E0',
  inkPrimary: '#000000',
  inkHigh: '#141414',
  inkBody: '#212121',
  inkLabel: '#737373',
  inkMuted: '#8C8C8C',
  inkPlaceholder: '#B8B8B8',
  inkDisabled: '#E0E0E0',
  inkOnBrand: '#FFFFFF',
  glassTintWarm: 'rgba(255, 248, 235, 0.55)',
  glassHairline: 'rgba(255, 255, 255, 0.6)',
  glassShadow: 'rgba(74, 50, 22, 0.18)',
} as const;

export const Palette = {
  black: '#000000',
  cream: '#DED8D3',
  warmGray: '#918C86',
  white: '#FFFFFF',
  warmTan: '#E0C9AF',
  glassCreamTint: 'rgba(222, 216, 211, 0.55)',
  glassHairline: 'rgba(255, 255, 255, 0.70)',
  glassShadow: 'rgba(0, 0, 0, 0.18)',
  pillInk: '#0A0A0A',
  pillHighlight: 'rgba(255, 255, 255, 0.10)',
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
  screen: 20,
} as const;

export const Radii = {
  card: 16,
  button: 12,
  pill: 24,
  avatar: 999,
  tag: 8,
  input: 12,
} as const;

const fontFamily = Platform.select({ ios: 'System', android: 'Roboto', default: 'System' });

/// Ambit type families. Bundled OTFs loaded via expo-font in app/_layout.tsx.
export const AmbitFont = {
  display: 'Zodiak-Bold',           // Headlines: "What's your vibe?"
  body: 'PlusJakartaSans-Regular',  // All body text, labels, CTAs
} as const;

/// Canonical type scale per Ambit Style Guide v1 / spec § design tokens.
/// Use with: <Text style={[TypeScale.h1, { color: Brand.inkPrimary }]}>...</Text>
export const TypeScale = {
  h1:     { fontFamily: AmbitFont.display, fontSize: 30 },
  title:  { fontFamily: AmbitFont.body, fontSize: 16, fontWeight: '600' as TextStyle['fontWeight'] },
  lead:   { fontFamily: AmbitFont.body, fontSize: 17 },
  body:   { fontFamily: AmbitFont.body, fontSize: 15 },
  input:  { fontFamily: AmbitFont.body, fontSize: 14 },
  helper: { fontFamily: AmbitFont.body, fontSize: 13 },
  chip:   { fontFamily: AmbitFont.body, fontSize: 13 },
  labelSm:{ fontFamily: AmbitFont.body, fontSize: 11, letterSpacing: 1.2 },
  nav:    { fontFamily: AmbitFont.body, fontSize: 10, fontWeight: '600' as TextStyle['fontWeight'] },
} as const;

export const Typography = {
  heading: {
    fontFamily,
    fontSize: 26,
    fontWeight: '600' as TextStyle['fontWeight'],
    color: Colors.textPrimary,
    lineHeight: 32,
  },
  subheading: {
    fontFamily,
    fontSize: 20,
    fontWeight: '600' as TextStyle['fontWeight'],
    color: Colors.textPrimary,
    lineHeight: 26,
  },
  name: {
    fontFamily,
    fontSize: 18,
    fontWeight: '600' as TextStyle['fontWeight'],
    color: Colors.textPrimary,
    lineHeight: 24,
  },
  body: {
    fontFamily,
    fontSize: 16,
    fontWeight: '400' as TextStyle['fontWeight'],
    color: Colors.textPrimary,
    lineHeight: 24,
  },
  vibe: {
    fontFamily,
    fontSize: 15,
    fontWeight: '400' as TextStyle['fontWeight'],
    fontStyle: 'italic' as TextStyle['fontStyle'],
    color: '#444444',
    lineHeight: 22,
  },
  caption: {
    fontFamily,
    fontSize: 13,
    fontWeight: '400' as TextStyle['fontWeight'],
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  label: {
    fontFamily,
    fontSize: 14,
    fontWeight: '500' as TextStyle['fontWeight'],
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  button: {
    fontFamily,
    fontSize: 16,
    fontWeight: '600' as TextStyle['fontWeight'],
    lineHeight: 22,
  },
} as const;

export const Shadows: ViewStyle = {
  shadowColor: '#000',
  shadowOpacity: 0.06,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 3,
};

export const SpringConfig = {
  card: { damping: 15, stiffness: 150, mass: 0.8 },
  button: { damping: 12, stiffness: 200, mass: 0.6 },
  toggle: { damping: 14, stiffness: 180, mass: 0.7 },
} as const;
