/// Ambit design tokens. Single source of truth for color, type, spacing, and shape.
/// ASTRA rebrand (2026-07): aubergine/iris palette, Playfair Display serif heroes,
/// Plus Jakarta Sans body, sharp radii, light-glass surfaces. All keys are kept
/// stable (values retinted in place) so the 76 consumers keep compiling.

// ---------- Color ----------

export const Brand = {
  // ── ASTRA system (2026-07) ────────────────────────────────────────────────
  // Warm near-white canvas · Playfair serif heroes · two-tier purple accent
  // (royal = primary/CTA, #9362C8 = selected/active). Sharp 4px surfaces,
  // light-glass overlays with expo-blur.
  primary:        '#2D005E',  // royal — decorative rails / gradient anchor
  accent:         '#9975CE',  // iris — warm decorative / secondary accent
  // The primary/CTA action color: royal purple. Buttons, send/connect, progress.
  action:         '#2D005E',  // royal — primary/action fill
  // NEW — the selected/active-state color. Distinct from `action` on purpose:
  // selected chips, selected option cards, active nav tab, active toggle.
  selected:       '#9362C8',  // active/selected state fill
  actionDeep:     '#1B0140',  // deep royal — links, strokes/icons on light
  actionInk:      '#1C1B1B',  // ink for text/border/edge (kept dark)
  danger:         '#C0392B',  // destructive / error
  // Success "tag" (LIVE / New / Hired) — soft emerald.
  tagMint:        '#D6F0E4',
  tagMintInk:     '#0E7A5C',
  seekerSurface:  '#F3EFF7',  // seeker themed card bg (soft lilac)
  seekerInk:      '#2D005E',  // seeker card title (royal)

  // Surfaces — warm near-white ground; white islands lift above it.
  canvas:         '#FCF9F8',  // base / canvas warm near-white
  cardCream:      '#FFFFFF',  // white island cards
  surface1:       '#FFFFFF',  // input fill, default chip fill
  surface2:       '#F0EDED',  // unselected fill (mist)
  borderDefault:  '#E5E2E1',  // hairline
  borderSoft:     'rgba(28, 27, 27, 0.07)',
  inkEdge:        '#1C1B1B',  // ink border/edge

  // Ink — near-black on warm near-white, with purple-leaning neutrals.
  inkPrimary:     '#1C1B1B',  // display headlines / primary text
  inkHigh:        '#14121A',
  inkBody:        '#4A4450',  // body text
  inkLabel:       '#6E6774',  // tertiary / labels — WCAG AA (≥4.5:1) on canvas & cards
  inkMuted:       '#6E6774',  // tertiary muted text — WCAG AA (≥4.5:1) on canvas & cards
  inkPlaceholder: '#9E97A3',  // muted / placeholder
  inkDisabled:    '#E5E2E1',
  inkOnBrand:     '#FFFFFF',  // text on royal CTAs

  // Nav-bar palette — light glass.
  navBarBg:       '#FCF9F8',
  navBarHairline: 'rgba(204, 195, 210, 0.4)', // lilac @0.4

  // Discovery card synthesis tokens — retinted into the iris family.
  terracotta:        '#9975CE',
  terracottaSurface: 'rgba(153, 117, 206, 0.06)',
  terracottaBorder:  'rgba(153, 117, 206, 0.18)',
  sage:              '#7B5AA6',
  sageBg:            'rgba(123, 90, 166, 0.10)',
  sageBorder:        'rgba(123, 90, 166, 0.22)',
  glassInk:          'rgba(45, 0, 94, 0.88)',   // translucent royal — signature action on light
  glassInkHover:     'rgba(45, 0, 94, 0.96)',
  glassHighlight:    'rgba(255, 255, 255, 0.34)', // inset top edge
  glassEdge:         'rgba(255, 255, 255, 0.28)', // outer hairline stroke

  // Hearth surface — chat thread direction. Soft purple washes over canvas,
  // glass icon buttons, royal outgoing bubbles with white text.
  hearthBgTop:        '#F3EFF7', // (legacy) top wash stop
  hearthBgBottom:     '#EDE7F2', // (legacy) bottom wash stop
  hearthBgBase:       '#FCF9F8', // canvas
  hearthGlassBg:      'rgba(252,249,248,0.85)',
  hearthGlassEdge:    'rgba(255,255,255,0.95)',
  hearthGlassShadow:  'rgba(28,27,27,0.12)',
  hearthBubbleMineTop:    '#3D0A70', // mine bubble — royal gradient top
  hearthBubbleMineBottom: '#2D005E', // mine bubble — royal gradient bottom
  hearthBubbleMineShadow: 'rgba(45,0,94,0.30)',
  hearthBubbleTheirsShadow: 'rgba(28,27,27,0.10)',
  hearthInkOnTan:     '#FFFFFF', // white ink on the royal "mine" bubble
  hearthPresenceGreen:'#9975CE', // presence → iris to match the system

  // Inbox — warm near-white canvas, flat active rows, soft purple pending cards,
  // rounded-square pale tiles with iris monograms.
  inboxCanvas:       '#FCF9F8',
  inboxCardActive:   'transparent',
  inboxCardPending:  'rgba(147,98,200,0.10)', // soft purple tint (pending = needs you)
  inboxAvatarBg:     '#F0EDED', // pale tile (mist)
  inboxHairline:     'rgba(28,27,27,0.08)',
  inboxBorderTan:    'rgba(147,98,200,0.28)', // purple hairline on pending
  inboxBronze:       '#7B7481', // muted secondary — monogram + bylines
  inboxBronzeDim:    '#9E97A3', // muted initial color
  inboxChipHired:    '#D6F0E4', // soft emerald status pill
  inboxInkPrimary:   '#1C1B1B',
  inboxInkBody:      '#4A4450',
  inboxInkMute:      'rgba(74,68,80,0.6)',
  inboxInkSoft:      '#CCC3D2', // lilac
} as const;

// ---------- ASTRA extended palette (new tokens, additive) ----------

/// Named ASTRA hues for Phase 2 consumers. `action`/`selected` above remain
/// the canonical primary + active tokens; these expose the fuller ramp.
export const Astra = {
  void:      '#0C0022',
  royal:     '#2D005E',
  iris:      '#9975CE',
  lilac:     '#CCC3D2',
  selected:  '#9362C8',
  canvas:    '#FCF9F8',
  paperAlt:  '#F6F3F2',
  card:      '#FFFFFF',
  mist:      '#F0EDED',
  hairline:  '#E5E2E1',
  hairlinePurple: 'rgba(111, 77, 162, 0.25)', // #6F4DA2 @0.25
  // Glass overlays
  glassFill: 'rgba(252, 249, 248, 0.85)',
  whiteA05:  'rgba(255,255,255,0.05)',
  whiteA20:  'rgba(255,255,255,0.20)',
  whiteA40:  'rgba(255,255,255,0.40)',
  darkA10:   'rgba(12,0,34,0.10)',
  darkA20:   'rgba(12,0,34,0.20)',
  // Void scrims for modal/sheet backdrops
  voidScrim40: 'rgba(12,0,34,0.40)',
  voidScrim45: 'rgba(12,0,34,0.45)',
  voidScrim60: 'rgba(12,0,34,0.60)',
} as const;

// ---------- Typography ----------

/// Font families. Playfair Display (serif) for hero/headings/wordmark ONLY;
/// Plus Jakarta Sans for everything else. Names match the exact families
/// loaded via @expo-google-fonts in app/_layout.tsx.
export const AmbitFont = {
  display:     'PlayfairDisplay_400Regular',
  displayBold: 'PlayfairDisplay_600SemiBold',
  body:        'PlusJakartaSans_400Regular',
  medium:      'PlusJakartaSans_500Medium',
  semibold:    'PlusJakartaSans_600SemiBold',
  bold:        'PlusJakartaSans_700Bold',
} as const;

// Type scale. Headings use Playfair; everything else Plus Jakarta Sans with the
// weight baked into the family name (so no fontWeight needed).
export const TypeScale = {
  h1:       { fontFamily: AmbitFont.display,  fontSize: 30 },
  h1Lg:     { fontFamily: AmbitFont.display,  fontSize: 36 },
  h1XL:     { fontFamily: AmbitFont.display,  fontSize: 128 },  // age gate
  title:    { fontFamily: AmbitFont.semibold, fontSize: 16 },
  lead:     { fontFamily: AmbitFont.body,     fontSize: 17 },
  body:     { fontFamily: AmbitFont.body,     fontSize: 15 },
  input:    { fontFamily: AmbitFont.body,     fontSize: 14 },
  helper:   { fontFamily: AmbitFont.body,     fontSize: 13 },
  chip:     { fontFamily: AmbitFont.medium,   fontSize: 13 },
  // Overline: Jakarta SemiBold, uppercase, tracked. Callers add textTransform.
  labelSm:  { fontFamily: AmbitFont.semibold, fontSize: 11, letterSpacing: 1.4 },
  nav:      { fontFamily: AmbitFont.semibold, fontSize: 10, letterSpacing: 1.2 },
  chevron:  { fontFamily: AmbitFont.body,     fontSize: 28 },
  counter:  { fontFamily: AmbitFont.semibold, fontSize: 12 },
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

// ---------- Border radii — SHARP ----------

export const Radii = {
  sm:    4,    // buttons, inputs, cards default
  md:    8,    // small cards / rows
  lg:    12,   // larger cards
  xl:    16,   // hero cards / sheets
  card:  12,   // island cards
  chip:  8,    // chips
  pill:  100,  // true pills
  full:  999,  // round icon buttons (avatars are squared, not full)
} as const;

// ---------- Owner funnel-stage colors (private CRM tag) ----------

/// Pipeline stage family: iris → amber → emerald. In Conversation = iris,
/// Decision Pending = amber, Hired = emerald. Kept 4-wide for the funnel keys.
export const StageRamp = ['#9975CE', '#C79A4C', '#3FA98A', '#10B981'] as const;

/// Private funnel stage → color, keyed by the OwnerStage values in
/// lib/closureLoop.ts.
export const StageColor = {
  new:          StageRamp[0],  // iris
  screening:    StageRamp[1],  // amber
  interviewing: StageRamp[2],  // teal-green
  finalist:     StageRamp[3],  // emerald
} as const;

// ---------- Status bar / system mock overlays (mock-only) ----------

export const System = {
  statusBarOverlay: 'rgba(0,0,0,0.2)',
  homeIndicator:    '#000000',
} as const;
