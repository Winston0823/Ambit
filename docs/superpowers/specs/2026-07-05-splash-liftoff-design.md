# Ambit Splash — "Liftoff" Design

**Date:** 2026-07-05
**Branch:** ux-fixes-2026-07-01
**Status:** Approved (design), pending implementation
**Design system:** ASTRA / Archival Cinematic

## Goal

Replace the bare `ambit` wordmark splash (`components/organisms/onboarding/SplashScreen.tsx`)
with an animated **rocket-liftoff** brand moment built from the new A-mark logo. The
mark's rocket launches up and out of the serif **A**, exhaust blooms, and the motion
settles into the `ambit` wordmark before handing off to onboarding — the whole splash
+ the onboarding welcome fade-in read as one continuous entry.

Runtime target ~2.4s. Everything reuses the built-in RN `Animated` API already in the
file (no new animation deps). `react-native-svg` 15.12.1 is already installed.

## The mark (build first, sign off before animating)

New reusable atom **`components/atoms/AmbitMark.tsx`** — the logo reconstructed as
`react-native-svg` with **three independently transformable layers**:

- **Layer A** — the serif **A** body. Fill `Astra.canvas` (#FCF9F8, white). Static anchor.
- **Layer B** — the **rocket** silhouette. Fill `Astra.void` (#0C0022, dark), matching
  the dark logo version. This is the layer that launches.
- **Layer C** — the **exhaust clouds**. Iris→royal vertical gradient
  (`Astra.iris` #9975CE → ~#6D4AA8 → `Astra.royal` #2D005E). Blooms on launch.

Props: `size` (number), plus optional per-layer animated-transform hooks so the splash
can drive each layer. Default render = clean static lockup. Reusable elsewhere later
(app header, loading states). No `fontWeight` usage anywhere (ASTRA rule — weight is
baked into the font family name).

**Gate:** render the STATIC mark in the running app, screenshot it, get user sign-off
on the drawing BEFORE wiring any animation.

## Backdrop

New atom **`components/atoms/StarfieldBackdrop.tsx`**:

- Void `#0C0022` fill (full screen).
- Soft iris radial glow (`RadialGradient`) centered behind the mark.
- ~18 low-opacity stars on a slow vertical drift loop. This is the one piece that can't
  use the native driver cleanly; keep it cheap. If it costs frames on the test device,
  fall back to a static twinkle (no drift).
- Reduced motion → stars + glow static.

## Choreography (5 beats, ~2.4s)

All timings live in ONE constants block at the top of `SplashScreen.tsx` so they're tunable.
Layer transforms (translateY / scale / opacity) run on the native driver by compositing
each mark layer in its own absolutely-positioned `Animated.View`.

| # | Beat     | Window       | Motion |
|---|----------|--------------|--------|
| 1 | Arrive   | 0–450ms      | Whole mark fades + eases up ~12px into place; radial glow fades in. |
| 2 | Charge   | 450–750ms    | Anticipatory swell of clouds; rocket dips ~3px (squash). |
| 3 | Liftoff  | 750–1300ms   | Rocket translateY up past the A's apex (easeIn→fast), fading as it clears; clouds bloom (scale + opacity up, then trail off). |
| 4 | Resolve  | 1150–1600ms  | `ambit` wordmark (Playfair `AmbitFont.display`, 64, `Astra.canvas`, current style) rises ~8px + fades in, seated beneath the A; holds. |
| 5 | Hand off | 1900–2400ms  | Everything fades out (600ms, easeInOut cubic — matches today's exit); `onContinue()` fires on the final frame. |

The A stays put the entire time (brand anchor). Wordmark sits BENEATH the A
(logo-over-word lockup) — the morph/crossfade alternative was considered and rejected
as too risky for a splash.

## Native boot splash (separate, static)

`app.json` currently shows the old `assets/splash-icon.png` on warm paper `#FCF9F8`,
then the JS splash flashes to void — jarring. Fix:

- Regenerate `assets/splash-icon.png` as the **dark-version mark centered on void**
  (render the new SVG mark to PNG — single source of truth, no higgsfield).
- Set `expo.splash.backgroundColor` to `#0C0022`.

Result: OS boot screen → animated splash → onboarding is one seamless dark runway.

## Accessibility & safety

- `AccessibilityInfo.isReduceMotionEnabled()` → collapse to a simple fade-in / hold /
  fade-out of the static mark + wordmark (today's behavior); no liftoff, no drift.
- Preserve the existing `anim.stop()` unmount cleanup so a resuming user's `setStep`
  can't race the auto-advance `onContinue` callback.
- `onContinue` contract with `OnboardingFlow.tsx` (line ~328) is unchanged — fires once,
  on the last frame.

## Files

- **new** `components/atoms/AmbitMark.tsx` — layered SVG logo
- **new** `components/atoms/StarfieldBackdrop.tsx` — void + glow + stars
- **edit** `components/organisms/onboarding/SplashScreen.tsx` — choreography
- **edit** `app.json` — boot splash bg + regenerated icon
- **regen** `assets/splash-icon.png` — dark mark on void
- **unchanged** `components/organisms/OnboardingFlow.tsx` — same `onContinue` contract

## Out of scope

- The app icon (`assets/icon.png` / `adaptive-icon.png`) — not this task.
- Any onboarding screen past the splash handoff.
- Sound/haptics on launch (could be a fun follow-up).
