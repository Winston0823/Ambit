# Portfolio Highlight Enrichment + Chat Attachment Parity

**Date:** 2026-06-04
**Status:** Design approved (Sub-project A). Sub-project B outlined for context.

## Goal

Make a seeker's **portfolio highlight** a richer, editable artifact (cover image,
role/contributions, timeframe, link, tools), then make a **shared** highlight in
chat render as a structured card that parallels the highlight itself.

## Decomposition

The work is split into two shippable sub-projects. Each gets its own
spec → plan → implementation cycle. **This spec fully specifies A**; B is
outlined so A's data shape anticipates it.

- **A — Portfolio Highlight Enrichment** (this spec): data model + editable
  image + new fields + display. Self-contained.
- **B — Chat Attachment Parity** (next): a seeker's shared highlight becomes a
  structured `portfolio_ref_id` message rendered as a card matching the
  highlight, tappable to a one-page preview. Depends on A.

## Mobbin research (informing the fields)

- **read.cv** — each project leads with **year**, title (+ link-out), short
  description. → timeframe + per-highlight link are core.
- **Speechify case study** — Challenge → Approach (bullets) → Results. →
  validates contributions bullets; outcome metrics optional (deferred).
- **Behance** — cover image + title front and center. → editable cover image.
- **Polywork** — link/tag chips per item.

## A. Design

### A.1 Data model

Extend `portfolio_items` in one additive migration. All new columns nullable /
defaulted so existing rows remain valid.

| column | type | notes |
|---|---|---|
| `timeframe` | `text` | e.g. "2025" / "Spring 2025". **Required in the editor**; nullable in DB for legacy rows. |
| `contributions` | `text[]` not null default `'{}'` | role/contribution bullets; optional |
| `link_url` | `text` | one external URL; optional |
| `tools` | `text[]` not null default `'{}'` | tech/tool tags; optional |

No RLS changes — `portfolio_items` policies (owner write, authenticated read)
and the `portfolio-images` bucket policies already cover this.

### A.2 Types + data layer

- `PortfolioItem` (data/mock.ts) gains: `timeframe: string` (''=unset),
  `contributions: string[]`, `linkUrl: string | null`, `tools: string[]`.
- `lib/portfolio.ts`:
  - `PortfolioRow` + the `select(...)` column lists gain the four columns.
  - `rowToItem` maps them (`contributions`/`tools` default `[]`, `linkUrl` from
    `link_url`, `timeframe` from `timeframe ?? ''`).
  - `upsertPortfolioItem` args gain `timeframe`, `contributions`, `linkUrl`,
    `tools` and writes them.
  - New `uploadPortfolioImage(userId, itemId, localUri): Promise<string>` —
    mirrors the avatar upload: `readLocalFileAsArrayBuffer` →
    `supabase.storage.from('portfolio-images').upload('{userId}/{itemId}.{ext}', …, { upsert: true })`
    → `getPublicUrl`. Returns the public URL.

### A.3 Image editing (PortfolioModal edit mode)

- The cover area becomes tappable in edit mode (shows current image or the
  gradient placeholder with a "Change photo" affordance).
- Tap → `ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [4, 3], quality: 0.85 })`.
- On pick: set the draft `imageUri` to the local URI immediately (instant
  preview); on Save, call `uploadPortfolioImage` and persist the returned URL
  via `upsertPortfolioItem`. If upload fails, keep the previous image and warn.

### A.4 Editor fields (PortfolioModal edit mode, below description)

- **Timeframe** — single-line `TextInput` (required; Save disabled until
  title + description + timeframe are non-empty).
- **Contributions** — one multiline `TextInput`; split on `\n`, trim, drop
  empties → `string[]`. Joined with `\n` to seed the draft when editing.
- **Link** — single-line URL `TextInput` (optional; `autoCapitalize=none`,
  `keyboardType=url`).
- **Tools** — single-line `TextInput`, comma-separated → trimmed `string[]`;
  rendered as chips below the field.

### A.5 Display (PortfolioModal view mode)

Order: cover image → **timeframe** eyebrow (uppercase, muted) → title →
description → **contributions** as a `•` list → **tools** chips → **link**
button ("View ↗", opens via `Linking.openURL`). Sections render only when their
data is present.

The discovery `HighlightRow` / `ShippingTile` stay as-is (thumb + title +
caption); the rich detail lives in the modal.

### A.6 Out of scope for A

- Outcome/impact field (deferred).
- Any chat / message changes (that is B).
- Changes to the discovery card layout beyond what already renders.

### A.7 Acceptance

- A user can change a highlight's cover image from the editor and it persists.
- Timeframe is required; contributions/link/tools are optional and persist.
- View mode shows all present fields; absent fields are omitted cleanly.
- Legacy rows (no new fields) still load and display without error.
- TypeScript strict, no `any`.

## B. Chat Attachment Parity (outline only — next cycle)

- Migration: `messages.portfolio_ref_id uuid references portfolio_items(id) on delete set null` (+ index), mirroring `project_ref_id`.
- `lib/messaging.ts`: `sendPortfolioAttachment` (sets `portfolio_ref_id`, body = `Shared a highlight · {title}`) and `fetchPortfolioRefs(ids)`.
- `ReachOutComposer`: for `attachMode === 'portfolio'`, pass the structured
  attachment and STOP appending the `📎 Sharing my work` text line.
- Send handlers (feed/saved/new): when `attachment` present, branch on
  `card.kind` — `seeker` → `sendProjectAttachment`, else → `sendPortfolioAttachment`.
- `MessageBubble`: add a `portfolio_ref_id` branch → `PortfolioAttachmentBubble`
  (compact card mirroring the discovery highlight look); tap → one-page preview
  (the `PortfolioModal` view mode).
- `chat/[id].tsx`: load portfolio refs like project refs; render + preview.
