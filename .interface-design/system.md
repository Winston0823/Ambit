# Ambit — Interface Design System

> Source of truth for the **Vocabulary-committed** visual language. Run
> `/audit` to catch drift from these rules. Code that disagrees with this file
> is the bug, not this file.

## Direction
Eggshell paper canvas, serif heroes (Zodiak), one tactile button language
(teal fill + ink border + a hard offset edge), mint status tags, dark nav bar.
Warm tan (`primary`/`accent`) is **decorative only** (gradients) — never an
interactive accent.

## Spacing — 4px grid
- **Base:** 4px
- **Scale:** 4, 8, 12, 16, 20, 24, 32
- **Tokens** (`constants/theme.ts → Space`): xs 4 · sm 8 · md 16 · lg 24 · xl 32 (12 + 20 fill the gaps).
- **Rule:** every `padding*`, `margin*`, and `gap` is a multiple of 4. 1–3px is
  allowed only for optical nudges + borders. **No 6, 10, 14, 18, 22.**

## Radius — `Radii`
- **Scale:** sm 8 · md 12 · lg 16 · pill 100 · full 999
- **Card (all island cards + the deck):** **20** (target — unify pending).
- **Pill / button:** 999 · **Input / small surface:** 12.

## Depth — three states, never mixed
- **HardShadow** (solid ink block, offset 3–8) = tactile objects: buttons,
  cards, the deck, the active filter tab. Use the `<HardShadow>` atom.
- **Soft lift** (`shadowRadius 14`, opacity ~.06) = **long scrolling list rows**
  only (inbox, search, candidates).
- **Flat** = everything else.
- **No RN `shadowRadius: 0`** — it renders blurry/seamed; migrate to `<HardShadow>`.

## Color — tokens only, no inline hex for palette colors
- **Action:** `action #A6C7C2` (fill) · `actionDeep #6E9CA1` (links/strokes/icons
  on cream) · `actionInk #1C1C1A` (text + border + the hard edge).
- **Tag:** `tagMint #DDEEE3` / `tagMintInk #3E6B53`.
- **Surfaces:** `canvas #F2EEE4` · `cardCream #FBFAF5` · `surface1 #F3EFE5` ·
  `surface2 #EBE6DA` · `borderSoft rgba(28,28,26,.07)` · `inkEdge #1C1C1A`.
- **Ink:** `inkPrimary #1C1C1A` · `inkBody #212121` · `inkMuted #8C8C8C`.
- **Danger:** `#C0392B` — **MISSING token**; currently inline ×11. Add `Brand.danger`.
- **Decorative gradients:** `primary #D4B490`, `accent #B48045` (gradients only).
- **Rule:** no inline hex for any palette color. `#6E9CA1` → `Brand.actionDeep`
  (currently inline ×23).

## Patterns
- **Button** (atom): pill 999, `action` fill, 1.6px `actionInk` border,
  `<HardShadow>`, `actionInk` label.
- **Card:** `cardCream` fill, 1–1.5px border (`borderSoft` or `inkEdge`),
  radius 20. Tactile cards (Discovery/Projects) add `<HardShadow>`; long-list
  rows use the soft lift.
- **Chip (selected):** `action` fill, ink border. Small chips: fill only, no shadow.
- **Tag (status):** mint pill, `tagMintInk` text.

## Known drift (audit backlog)
1. Spacing off-grid (6/10/14/18/22) — **being fixed now (grid-snap)**.
2. Card radius inconsistent (16/18/20/22) → unify to 20.
3. Depth: 11 files still on RN `shadowRadius:0` → migrate to `<HardShadow>`.
4. `#6E9CA1` inline ×23 → `Brand.actionDeep`; add `Brand.danger` for `#C0392B` ×11.
