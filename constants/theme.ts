import { Platform, TextStyle } from 'react-native';

/// Ambit design tokens. Single source of truth for color, type, spacing, and shape.
/// Synced from Figma `AMBIT` file (Style And References page) + spec § design tokens.

// ---------- Color ----------

export const Brand = {
  // ── LOCKED "Vocabulary-committed" system (2026-06-05) ──────────────────────
  // Eggshell paper · serif heroes · one tactile button language (teal fill +
  // ink border + a HARD black offset edge below — not a soft shadow). See
  // Obsidian Vault/Ambit/Design/Vocabulary Steer.md.
  primary:        '#D4B490',  // warm tan — warm-decorative only (rails/gradients)
  accent:         '#B48045',  // deeper tan — warm decorative
  // The signature interactive accent: muted teal-blue fill, ink border + edge.
  action:         '#A6C7C2',  // teal-blue button/selected fill
  actionDeep:     '#6E9CA1',  // deeper teal — links, the wave, icons/strokes on cream
  actionInk:      '#1C1C1A',  // text + border + the hard offset edge on `action`
  danger:         '#C0392B',  // destructive / error (decline, withdraw, validation)
  // Mint "tag" (LIVE / New / status).
  tagMint:        '#DDEEE3',
  tagMintInk:     '#3E6B53',
  seekerSurface:  '#F2E8DD',  // seeker themed card bg
  seekerInk:      '#4D361D',  // seeker card title (deep brown on sand)

  // Surfaces — eggshell paper ground; cream islands lift above it.
  canvas:         '#F2EEE4',  // warm eggshell paper (lightened)
  cardCream:      '#FBFAF5',  // cream island cards
  surface1:       '#F3EFE5',  // input fill, default chip fill
  surface2:       '#EBE6DA',  // unselected fill
  borderDefault:  '#E4DECF',  // soft hairlines
  borderSoft:     'rgba(28, 28, 26, 0.07)',
  inkEdge:        '#1C1C1A',  // hard tactile border/edge on buttons + cards

  // Ink — refined neutral near-black on eggshell.
  inkPrimary:     '#1C1C1A',  // display headlines
  inkHigh:        '#141414',
  inkBody:        '#212121',
  inkLabel:       '#737373',
  inkMuted:       '#8C8C8C',
  inkPlaceholder: '#B8B8B8',
  inkDisabled:    '#E0E0E0',
  inkOnBrand:     '#FFFFFF',  // text on warm-tan CTAs

  // Nav-bar palette
  navBarBg:       'rgb(41, 41, 41)',   // dark gray, solid (matches SwiftUI Color(white: 0.16))
  navBarHairline: 'rgba(255,255,255,0.06)',

  // Discovery card v2 — synthesis tokens (terracotta for skills, sage for Venn,
  // brown glass for the liquid-glass CTA). Added 2026-05-26 with the g-synthesis
  // port; see /tmp/ambit-card-explorations/g-synthesis.html for the mock.
  terracotta:        '#C76F4A',
  terracottaSurface: 'rgba(199, 111, 74, 0.06)',
  terracottaBorder:  'rgba(199, 111, 74, 0.18)',
  sage:              '#8A9B7A',
  sageBg:            'rgba(138, 155, 122, 0.10)',
  sageBorder:        'rgba(138, 155, 122, 0.22)',
  glassInk:          'rgba(180, 128, 69, 0.88)',  // translucent accent tan — brand-signature warm color, opaque enough to read as primary action on cream
  glassInkHover:     'rgba(180, 128, 69, 0.96)',
  glassHighlight:    'rgba(255, 255, 255, 0.34)', // inset top edge — brighter "lit glass" feel
  glassEdge:         'rgba(255, 255, 255, 0.28)', // outer hairline stroke so the pill's edge is defined on cream

  // Hearth surface — chat thread direction. Warm radial-style washes layered
  // over the canvas, glass icon buttons, tactile bubbles with gradient + rim.
  hearthBgTop:        '#FAEAD0', // (legacy) top wash stop — kept for reference; no longer used
  hearthBgBottom:     '#F1DDB6', // (legacy) bottom wash stop — kept for reference; no longer used
  hearthBgBase:       '#F2EEE4', // eggshell paper — matches the app canvas
  hearthGlassBg:      'rgba(251,250,245,0.8)',
  hearthGlassEdge:    'rgba(255,255,255,0.95)',
  hearthGlassShadow:  'rgba(28,28,26,0.12)',
  hearthBubbleMineTop:    '#B0CFCB', // mine bubble — teal gradient top
  hearthBubbleMineBottom: '#A6C7C2', // mine bubble — teal gradient bottom
  hearthBubbleMineShadow: 'rgba(110,156,161,0.30)',
  hearthBubbleTheirsShadow: 'rgba(28,28,26,0.10)',
  hearthInkOnTan:     '#1C1C1A', // ink text on the teal "mine" bubble
  hearthPresenceGreen:'#6E9CA1', // presence → teal to match the system

  // Inbox v5 — Stitch's "Clean Warm Chat Interface" direction. Warm
  // cream canvas, flat active rows divided by hairlines, pending
  // reach-outs are the only cards (soft golden cream), avatars are
  // rounded-square pale gray tiles with italic bronze monograms.
  // Source: `_design/Stitch — Refined Design.html`.
  inboxCanvas:       '#F2EEE4', // eggshell — matches the app canvas
  inboxCardActive:   'transparent', // active rows are flat — no card fill
  inboxCardPending:  'rgba(166,199,194,0.14)', // soft teal-tint (pending = needs you)
  inboxAvatarBg:     '#ECE7DB', // pale tile
  inboxHairline:     'rgba(28,28,26,0.08)',
  inboxBorderTan:    'rgba(110,156,161,0.28)', // teal hairline on pending
  inboxBronze:       '#8C857A', // de-warmed muted secondary — monogram + bylines
  inboxBronzeDim:    '#B8B0A2', // muted initial color
  inboxChipHired:    '#DDEEE3', // mint status pill
  inboxInkPrimary:   '#1C1C1A',
  inboxInkBody:      '#444748',
  inboxInkMute:      'rgba(68,71,72,0.6)',
  inboxInkSoft:      '#C4C7C7',
} as const;

// ---------- Typography ----------

export const AmbitFont = {
  display: 'Zodiak-Bold',
  body:    'PlusJakartaSans-Regular',
} as const;

// Type scale per spec § design tokens. Use as: <Text style={TypeScale.h1}>...</Text>
export const TypeScale = {
  h1:       { fontFamily: AmbitFont.display, fontSize: 30 },
  h1Lg:     { fontFamily: AmbitFont.display, fontSize: 36 },
  h1XL:     { fontFamily: AmbitFont.display, fontSize: 128 },  // age gate
  title:    { fontFamily: AmbitFont.body,    fontSize: 16, fontWeight: '600' as TextStyle['fontWeight'] },
  lead:     { fontFamily: AmbitFont.body,    fontSize: 17 },
  body:     { fontFamily: AmbitFont.body,    fontSize: 15 },
  input:    { fontFamily: AmbitFont.body,    fontSize: 14 },
  helper:   { fontFamily: AmbitFont.body,    fontSize: 13 },
  chip:     { fontFamily: AmbitFont.body,    fontSize: 13 },
  labelSm:  { fontFamily: AmbitFont.body,    fontSize: 11, letterSpacing: 1.2 },
  nav:      { fontFamily: AmbitFont.body,    fontSize: 10, fontWeight: '600' as TextStyle['fontWeight'] },
  chevron:  { fontFamily: AmbitFont.body,    fontSize: 28 },
  counter:  { fontFamily: AmbitFont.body,    fontSize: 12 },
} as const;

// ---------- Spacing ----------

export const Space = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 50,
  screenH: 24,
  ctaBottom: 60,
} as const;

// ---------- Border radii ----------

export const Radii = {
  sm:    8,    // counter pill, small badge
  md:    12,   // CTA buttons, search input
  lg:    16,   // cards, textarea, option cards
  card:  20,   // island cards (cream/gradient surfaces, swipe deck)
  pill:  100,  // skill chips
  full:  999,  // avatars
} as const;

// ---------- Owner funnel-stage colors (private CRM tag) ----------

/// A warm→cool progression ramp at matched HSL saturation/lightness (S≈55%,
/// L≈58%) so the four read as one tonal family: orange → yellow → green → blue.
/// Drives BOTH the private funnel stages (keyed below) and the shared status
/// milestones (by index) in the chat StageRail, left→right.
export const StageRamp = ['#CF9459', '#CFC359', '#59CF80', '#5994CF'] as const;

/// Private funnel stage → color, keyed by the OwnerStage values in
/// lib/closureLoop.ts. Same ramp, named.
export const StageColor = {
  new:          StageRamp[0],  // orange
  screening:    StageRamp[1],  // yellow
  interviewing: StageRamp[2],  // green
  finalist:     StageRamp[3],  // blue
} as const;

// ---------- Status bar / system mock overlays (mock-only) ----------

export const System = {
  statusBarOverlay: 'rgba(0,0,0,0.2)',
  homeIndicator:    '#000000',
} as const;
