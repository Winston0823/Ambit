# Reach-Out Composer — "Add Media" Floating Treatment

**Date:** 2026-06-03
**Component:** `components/molecules/ReachOutComposer.tsx`
**Type:** Visual restyle (no structural / logic change)

## Goal

Make the reach-out composer's media tray reference the Apple Journal "Add media"
aesthetic: glossy media cards floating above a surface that fades downward into
the keyboard. Reference: floating black pill labels over glossy gradient cards,
a centered caption, and a white fade dissolving into a (faded) keyboard.

## Decisions

- **Backdrop:** Live keyboard + white seam. The real iOS keyboard is a system
  layer we cannot repaint, so the "faded keyboard" is evoked with a
  white→transparent gradient seam at the bottom of the tray, not a fake keyboard.
- **Trigger:** Always inline (current). The attach tray stays visible above the
  message bubble; tapping the collapsed stack still expands the fan. No new
  "attach state."

## In Scope

Styling only, on the existing `AttachStack`, `AttachFan`, `TileFace`, and the
sheet's bottom region:

1. **Under-glow reflection** beneath the fanned cards — a soft, blurred,
   low-opacity colored glow mirrored under the media, tinted from the cards'
   own gradient/tan tones, so the media reads as floating on a glossy floor.
2. **White fade seam** — a white→transparent `LinearGradient` strip at the
   bottom of the tray region, just above the message bubble.
3. **Card gloss + floating labels** — sharper top-edge gloss highlight on each
   tile, deeper soft shadow, black pill labels hugging each card's top.
4. **Caption** — keep centered bold caption ("Attach a project" /
   "Share a portfolio highlight"), styled like the reference's grey caption.
5. **Sheet chrome** — soften to read as a light floating surface: keep grabber +
   rounded top, lift cards with larger soft shadows, keep white canvas.

## Out of Scope (unchanged)

- Project-vs-portfolio mapping (already correct: reach-out to a seeker card →
  attach a project; reach-out to an owner card → attach a portfolio highlight).
- Trigger model, send/celebration animation, keyboard behavior, data fetching.

## Acceptance

- TypeScript compiles clean (`no any`, strict).
- Collapsed and expanded tray both show the floating/glossy treatment.
- White seam reads as the tray dissolving toward the keyboard.
- No regression to send flow or attach selection.
