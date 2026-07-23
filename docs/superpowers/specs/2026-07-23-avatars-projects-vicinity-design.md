# Avatars, Project Emphasis, Vicinity, Professors Cut — Design

**Date:** 2026-07-23
**Status:** Approved direction; pending final user review
**Scope:** Core product changes across identity (avatars), onboarding, discovery cards, and profile.

## Summary

Four coordinated changes:

1. **Profile photos become a post-connection reveal.** Pre-connection, everyone is represented by a curated set of 12 playful monster avatars ("marks") in the ASTRA palette, picked from a grid. The real photo (optional) is revealed only after a conversation becomes mutual — the other person responded.
2. **Projects get more emphasis**: a new skippable onboarding step lets every user (seeker or owner) add past-work highlights to their profile, and the discovery card becomes project-forward now that photos are gone.
3. **Campus selector is cut**, replaced by a single vicinity preference: open to working in person nearby, or remote only.
4. **Professors are cut**: the "student or professor?" demographic step disappears; everyone is a student.

---

## 1. Monster avatar system

### Assets

12 pre-generated monster icons live at `assets/avatars/monster-01.png` … `monster-12.png` (512×512, transparent background). ClassDojo-style full-body characters generated via Higgsfield in the ASTRA palette (royal `#2D005E`, iris `#9975CE`, violet `#9362C8`, lilac `#F3EFF7`, aubergine `#1B0140`). Source sheet + slicer script archived in session scratchpad; regeneration is possible via the same prompt.

> Asset note: PNGs are ~140KB each (1.7MB total). Run them through `pngquant`/`oxipng` during implementation to cut bundle weight.

### Data model

- `profiles.avatar_id text` — key like `"monster-03"`. New users get a random default at onboarding.
- `profiles.photo_url` and the `avatars` bucket are **kept** — the photo is now the post-connection reveal (see "Photo reveal" below).
- Migration: add `avatar_id` (backfill existing rows with a deterministic pick, e.g. hash(id) mod 12).

### Photo reveal mechanic

The monster is the public mask; the real photo is private until trust is established.

- **Reveal predicate:** user B's photo is visible to user A iff a `conversations` row exists between them where **both participants have sent ≥1 message** (the recipient chose to respond — same initiator derivation as migration 038) and `status` is not `passed`/`auto_declined`. No photo uploaded → monster everywhere, always.
- **Enforcement is server-side:** a new `security definer` RPC `fetch_peer_photos(peer_ids uuid[]) → (user_id, photo_url)` returns photo URLs only for peers satisfying the predicate against `auth.uid()`. All client base queries (feed, saved, new-chat search, projects tab) stop selecting `photo_url`. Hardening: revoke column-level `select` on `profiles.photo_url` from `authenticated` so the RPC is the only read path (client code always selects explicit column lists, so this is safe).
- **Where photos appear once revealed:** chat thread header + message avatars, partner profile island, inbox rows for mutual threads. Everywhere else (discovery, saved, search, pending/unanswered threads) stays monster.
- **Reveal moment:** when a thread turns mutual, the avatar swap is a small delight beat — the monster crossfades to the photo in the thread header (respect reduced motion).

### Components

- New `components/atoms/Avatar.tsx`: `{ avatarId, photoUrl?, size, surface? }` → renders `photoUrl` when provided (i.e., the caller is a revealed context that fetched it via `fetch_peer_photos`), otherwise the mapped bundled monster PNG inside the standard circular/rounded tile (lilac `#F3EFF7` fill by default so the transparent PNG always has ground). Static `require` map for all 12.
- New `components/molecules/AvatarPickerSheet.tsx`: a grid of the 12 monsters (3×4), current selection ringed in `Brand.selected`; tapping saves `avatar_id`.
- **Replaces all 8+ inline photo/initial fallbacks**: `MessageBubble` local Avatar, `InboxRow`, `PinnedStrip`, `chat/new` rows, `DiscoveryCard`, `OwnerProfileCard`, `projects.tsx` collaborator faces, `saved`/`SavedCarousel`, `project-manage`.

### Surfaces

- **Onboarding (name step, formerly PhotoScreen):** renamed `IdentityScreen`. Captures the name (unchanged gate: length > 1) and shows the user's randomly-dealt monster large with a "change" affordance opening the picker grid. Below it, an optional "Add a photo — only shown after someone connects with you" row keeps the existing picker; photo upload at submit is unchanged.
- **Profile tab:** the hero renders the monster; the old "Add photo / Change photo" row becomes **"Change icon"** → opens `AvatarPickerSheet`, with a secondary **"Change photo"** row beneath it (copy: "revealed after you connect") keeping the existing `pickPhoto` upload.
- Own photo is always visible to yourself on the profile tab (small, next to the reveal copy) so users know what connections will see.

## 2. Project emphasis + onboarding highlights

### Onboarding step: Highlights (new, skippable)

- Position: after `vicinity`, before `complete`. Shown to **both** roles.
- A lite version of the existing profile highlight editor writing to the existing `portfolio_items` table: title (required), one-liner description, optional cover image, optional tools tags. Users can add 1–3 entries; "Skip for now" continues without.
- Items are held in `OnboardingContext` state and inserted at final submit (same pattern the photo upload used), via `upsertPortfolioItem` + `uploadPortfolioImage`.
- Skipping preserves the current profile-tab empty state / progressive completion path.

### Discovery card becomes project-forward

- The seeker card's `PhotoPanel` (previously the user's photo) becomes the **top portfolio highlight's image**. Fallback when no highlight or no image: lilac panel with the user's monster avatar centered.
- The identity row shows the monster avatar small + name; portfolio bubbles stay as the deep-dive.
- Project cards: fallback chain `imageUri ?? ownerPhotoUri` becomes `imageUri ?? owner monster avatar` over the existing royal→iris gradient.

## 3. Campus → vicinity

- **Cut:** `CampusScreen`, `CAMPUSES` constant + `Campus` interface, profile campus `PickerField` + sheet, campus eyebrows on cards, `campus_id` from the `project-new` insert.
- **New:** `profiles.open_to_nearby boolean` (null until answered; onboarding gate requires a choice).
- **Onboarding Vicinity step** (same slot campus occupied): "Are you open to working in person nearby?" — two option cards: *In person nearby* / *Remote only*.
- **Profile edit:** toggle field replacing the campus picker.
- **Card copy:** eyebrow shows `IN PERSON` / `REMOTE` where the school name used to be; project cards show the owner's preference.
- **Migration:** add `open_to_nearby`; drop `campus_id` from `profiles` and `projects`; redefine the latest matching RPCs (`035_pass_cooldown` / `037_owner_deck_parity` definitions) without `campus_id` in their return signatures. Campus was pass-through metadata only — no filtering logic exists, so matching behavior is unchanged.

## 4. Professors cut

- Delete `DemographicScreen`; remove the `demographic` step from `STEPS`.
- Remove `Demographic` type, `profile.demographic` field, professor→owner coercion (`OnboardingContext` update/submit), and professor step-skipping in `shouldShow`. Remaining owner logic: owners still skip `skills`.
- Remove professor mention from `constants/legal.ts`.
- Delete orphaned `VibeBlurbScreen.tsx` / `ProofLinksScreen.tsx` only if still unwired after these changes (they are today).
- Migration: drop `profiles.demographic`.

## 5. Resulting onboarding flow

```
splash → welcome → preview → eduEmail → identity (name + monster) → role
      → skills (seekers only) → vicinity → highlights (skippable) → complete
```

Progress-bar steps: `eduEmail, identity, role, skills, vicinity, highlights`. `(founder)` route group is pure re-exports, so all edits land once in `(candidate)`.

## Error handling

- Avatar map lookups fall back to `monster-01` for unknown/legacy `avatar_id` values.
- Highlights inserted at submit: failures toast-and-continue (profile still created), matching the existing photo-upload failure behavior.
- `fetch_peer_photos` failures degrade gracefully: revealed contexts simply keep showing the monster.
- Migration drops `demographic` and `campus_id` (destructive, accepted — prototype has no production users). Photos (`photo_url`, avatars bucket) are **kept**.

## Testing / verification

- `tsc --noEmit` clean.
- Migration applies cleanly against local Supabase; RPCs return without `campus_id`.
- Reveal predicate tested at the SQL level: `fetch_peer_photos` returns a photo only for mutual, non-passed conversations (one-sided reach-out → no photo; after recipient replies → photo).
- Simulator run-through: full onboarding (both roles, with and without highlights/photo), feed cards (seeker + project — always monsters), chat thread before and after the recipient's first reply (monster → photo swap), profile "Change icon" + "Change photo" flows, saved deck.

## Out of scope

- Real geolocation / distance matching (vicinity is a boolean preference only).
- Avatar customization beyond picking from the 12 (no color variants, no editor).
- Reordering or redesigning the profile tab beyond the photo→icon row swap.
