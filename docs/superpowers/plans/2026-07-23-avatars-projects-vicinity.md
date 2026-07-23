# Avatars, Photo Reveal, Highlights, Vicinity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace public profile photos with picked monster avatars (photos become a post-connection reveal), add a skippable past-work Highlights onboarding step, swap the campus selector for an in-person vicinity preference, and remove professors.

**Architecture:** One additive/destructive SQL migration (avatar_id + open_to_nearby + photo-reveal RPC + drops), one shared `Avatar` atom consuming 12 bundled monster PNGs, onboarding flow rewired (identity → role → skills → vicinity → highlights), and a server-enforced `fetch_peer_photos` RPC as the *only* read path for other users' photos.

**Tech Stack:** Expo 54 / expo-router, React Native, TypeScript (strict, no `any`), Supabase (Postgres RLS + RPC), phosphor-react-native icons, expo-image.

**Spec:** `docs/superpowers/specs/2026-07-23-avatars-projects-vicinity-design.md` — read it first.

## Global Constraints

- ASTRA tokens only — import from `constants/theme` (`Brand`, `Astra`, `AmbitFont`, `Radii`, `Space`). No hardcoded hex except inside the theme file.
- No `any` types. Match existing file style (triple-slash doc comments, StyleSheet at bottom).
- `(founder)` route group files are one-line re-exports of `(candidate)` — never edit them.
- Avatar asset keys are `"monster-01"` … `"monster-12"` ↔ `assets/avatars/monster-NN.png` (already committed).
- No test framework exists in this repo; the verification loop is `npx tsc --noEmit` (must be clean) plus the SQL/runtime checks written into each task. Do not add a test framework.
- Commit after every task on the current branch (`ux-fixes-2026-07-01`).
- Copy rule: the vicinity options are exactly "In person nearby" and "Remote only"; card eyebrow strings are exactly `IN PERSON` / `REMOTE`.

---

### Task 1: Migration 039 — avatar_id, open_to_nearby, photo reveal RPC, drops

**Files:**
- Create: `supabase/migrations/039_avatars_reveal_vicinity.sql`
- Read first: `supabase/migrations/035_pass_cooldown.sql`, `supabase/migrations/037_owner_deck_parity.sql` (current RPC definitions to redefine), `supabase/migrations/003_messaging.sql` (conversations shape)

**Interfaces:**
- Produces: `profiles.avatar_id text not null default 'monster-01'`, `profiles.open_to_nearby boolean` (nullable), RPC `fetch_peer_photos(peer_ids uuid[]) returns table(user_id uuid, photo_url text)`.
- Drops: `profiles.demographic`, `profiles.campus_id`, `projects.campus_id`, and column-level select on `profiles.photo_url` for `authenticated`.
- Later tasks rely on: RPC name `fetch_peer_photos`, arg name `peer_ids`.

- [ ] **Step 1: Read 035 + 037 and copy the latest `compat_projects_for_seeker` and owner-deck RPC bodies** into the new migration, removing `campus_id` from their `returns table (...)` signatures and select lists. Everything else stays byte-identical.

- [ ] **Step 2: Write the rest of the migration**

```sql
-- ============================================================
-- 039_avatars_reveal_vicinity.sql · Monster avatars + photo-as-
-- reveal + vicinity preference + professors/campus removal.
-- Spec: docs/superpowers/specs/2026-07-23-avatars-projects-vicinity-design.md
-- ============================================================

-- ── 1. avatar_id — picked monster mark ──────────────────────
alter table profiles
  add column if not exists avatar_id text not null default 'monster-01'
  check (avatar_id ~ '^monster-(0[1-9]|1[0-2])$');

-- Deterministic backfill so existing users don't all share monster-01.
update profiles
   set avatar_id = 'monster-' || lpad(((('x' || substr(md5(id::text), 1, 8))::bit(32)::int & 2147483647) % 12 + 1)::text, 2, '0')
 where avatar_id = 'monster-01';

-- ── 2. open_to_nearby — vicinity preference ─────────────────
-- Null = unanswered (onboarding gates on a choice).
alter table profiles add column if not exists open_to_nearby boolean;

-- ── 3. photo reveal — server-side gate ──────────────────────
-- A peer's photo is visible iff (a) it's your own, or (b) a
-- conversation exists between you where BOTH parties have sent a
-- user message (the recipient chose to respond) and the thread is
-- not passed/auto_declined. Same mutuality derivation as 038.
create or replace function fetch_peer_photos(peer_ids uuid[])
returns table (user_id uuid, photo_url text)
language sql security definer set search_path = public as $$
  select p.id, p.photo_url
  from profiles p
  where p.id = any(peer_ids)
    and p.photo_url is not null
    and (
      p.id = auth.uid()
      or exists (
        select 1
        from conversations c
        where c.status not in ('passed', 'auto_declined')
          and ((c.owner_id = auth.uid() and c.seeker_id = p.id)
            or (c.seeker_id = auth.uid() and c.owner_id = p.id))
          and exists (select 1 from messages m
                       where m.conversation_id = c.id
                         and m.sender_id = auth.uid() and m.deleted_at is null)
          and exists (select 1 from messages m
                       where m.conversation_id = c.id
                         and m.sender_id = p.id and m.deleted_at is null)
      )
    )
$$;
revoke all on function fetch_peer_photos(uuid[]) from public;
grant execute on function fetch_peer_photos(uuid[]) to authenticated;

-- Hardening: the RPC is the ONLY read path for photo_url.
revoke select (photo_url) on profiles from authenticated;

-- ── 4. professors + campus removal ──────────────────────────
alter table profiles drop column if exists demographic;
alter table profiles drop column if exists campus_id;
alter table projects drop column if exists campus_id;

-- ── 5. RPC redefinitions without campus_id ──────────────────
-- (Step 1 content: latest bodies from 035/037 minus campus_id.)
```

Note: dropping `projects.campus_id` will fail with `cannot drop … because other objects depend on it` if the old RPCs reference it — that is why Step 1's redefinitions must appear ABOVE the drops if needed; reorder so redefinitions run before the drops, or `drop function` first then recreate after. Verify ordering when writing the final file.

- [ ] **Step 3: Apply** — `supabase db push` (or `supabase migration up` for local). Expected: applies cleanly.

- [ ] **Step 4: Verify the reveal predicate in SQL** (Supabase SQL editor or `psql`):

```sql
-- As service role, sanity-check shape:
select * from fetch_peer_photos(array[]::uuid[]);         -- 0 rows, no error
-- Manual check with two seeded users A/B and a conversation:
-- 1) only A has messaged  -> fetch_peer_photos as A for [B] returns 0 rows
-- 2) B replies            -> returns B's row (if B has photo_url)
```

- [ ] **Step 5: Commit** — `git add supabase/migrations/039_avatars_reveal_vicinity.sql && git commit -m "feat: migration — avatar_id, vicinity, photo-reveal RPC, drop demographic/campus"`

---

### Task 2: Avatar atom + avatar registry

**Files:**
- Create: `components/atoms/Avatar.tsx`
- Modify: `components/atoms/index.ts` (add export)

**Interfaces:**
- Produces (all later tasks use these):
  - `AVATAR_IDS: readonly string[]` — `['monster-01', …, 'monster-12']`
  - `avatarSource(avatarId: string | null | undefined): number` — require() handle, falls back to monster-01 for unknown ids
  - `randomAvatarId(): string`
  - `<Avatar avatarId={string|null} photoUrl={string|null|undefined} size={number} />` — renders photoUrl when given (revealed contexts only), else monster on lilac tile. Circular (borderRadius size/2), monster PNG inset ~12% so limbs never clip.

- [ ] **Step 1: Write `components/atoms/Avatar.tsx`**

```tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Brand } from '../../constants/theme';

/// The 12 bundled monster marks. Keys are persisted in profiles.avatar_id —
/// never rename without a data migration.
const AVATAR_MAP: Record<string, number> = {
  'monster-01': require('../../assets/avatars/monster-01.png'),
  'monster-02': require('../../assets/avatars/monster-02.png'),
  'monster-03': require('../../assets/avatars/monster-03.png'),
  'monster-04': require('../../assets/avatars/monster-04.png'),
  'monster-05': require('../../assets/avatars/monster-05.png'),
  'monster-06': require('../../assets/avatars/monster-06.png'),
  'monster-07': require('../../assets/avatars/monster-07.png'),
  'monster-08': require('../../assets/avatars/monster-08.png'),
  'monster-09': require('../../assets/avatars/monster-09.png'),
  'monster-10': require('../../assets/avatars/monster-10.png'),
  'monster-11': require('../../assets/avatars/monster-11.png'),
  'monster-12': require('../../assets/avatars/monster-12.png'),
};

export const AVATAR_IDS = Object.keys(AVATAR_MAP) as readonly string[];

export function avatarSource(avatarId: string | null | undefined): number {
  return AVATAR_MAP[avatarId ?? ''] ?? AVATAR_MAP['monster-01'];
}

export function randomAvatarId(): string {
  return AVATAR_IDS[Math.floor(Math.random() * AVATAR_IDS.length)];
}

interface Props {
  avatarId: string | null | undefined;
  /// Only revealed contexts pass this — a URL returned by fetch_peer_photos.
  photoUrl?: string | null;
  size: number;
}

/// The single identity visual. Photo when revealed, monster mark otherwise.
export function Avatar({ avatarId, photoUrl, size }: Props) {
  const radius = size / 2;
  if (photoUrl) {
    return (
      <Image
        source={{ uri: photoUrl }}
        style={{ width: size, height: size, borderRadius: radius }}
        cachePolicy="memory-disk"
        transition={180}
      />
    );
  }
  const inset = Math.round(size * 0.12);
  return (
    <View style={[styles.tile, { width: size, height: size, borderRadius: radius }]}>
      <Image
        source={avatarSource(avatarId)}
        style={{ width: size - inset * 2, height: size - inset * 2 }}
        contentFit="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    backgroundColor: Brand.seekerSurface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
```

- [ ] **Step 2: Export from `components/atoms/index.ts`** — add `export { Avatar, AVATAR_IDS, avatarSource, randomAvatarId } from './Avatar';` matching the barrel's existing style.

- [ ] **Step 3: Verify** — `npx tsc --noEmit` clean.

- [ ] **Step 4: Commit** — `git commit -m "feat: shared Avatar atom with bundled monster marks"`

---

### Task 3: AvatarPickerSheet molecule

**Files:**
- Create: `components/molecules/AvatarPickerSheet.tsx`
- Modify: `components/molecules/index.ts` (add export)

**Interfaces:**
- Consumes: `AVATAR_IDS`, `avatarSource` from `../atoms`.
- Produces: `<AvatarPickerSheet visible selectedId onSelect={(id: string) => void} onClose={() => void} />` — bottom-sheet Modal, 3-column grid of the 12 monsters, current selection ringed in `Brand.selected`; tapping a monster calls `onSelect(id)` then `onClose()`.

- [ ] **Step 1: Write the component.** Follow the Modal patterns used elsewhere in molecules (transparent backdrop pressable to dismiss, sheet slides from bottom, `Radii.lg` top corners, `Brand.cardCream` sheet). Grid: `flexWrap` rows of 3, each cell a `Pressable` containing `<Image source={avatarSource(id)} style={{width: 72, height: 72}} contentFit="contain" />` on a `Brand.seekerSurface` rounded tile; selected cell gets `borderWidth: 2, borderColor: Brand.selected`. Title row: kicker-style label "PICK YOUR MARK" (`AmbitFont.semibold`, 12, letterSpacing 1.5, `Brand.inkLabel`). Include `accessibilityRole="button"` + `accessibilityState={{ selected }}` per cell.

- [ ] **Step 2: Verify** — `npx tsc --noEmit` clean.

- [ ] **Step 3: Commit** — `git commit -m "feat: AvatarPickerSheet monster grid"`

---

### Task 4: OnboardingContext — new fields, submit, hydrate

**Files:**
- Modify: `context/OnboardingContext.tsx`

**Interfaces:**
- Produces (screens in Tasks 5–7 consume): `OnboardingProfile` gains `avatarId: string`, `openToNearby: boolean | null`, `highlights: OnboardingHighlight[]`; loses `demographic`, `campusId`. New exported type:

```ts
export interface OnboardingHighlight {
  id: string;            // client-side UUID (expo-crypto randomUUID)
  title: string;
  description: string;
  imageUri: string | null;  // local picker uri, uploaded at submit
}
```

- `Demographic` type deleted.

- [ ] **Step 1: Rewrite the profile shape.** In `OnboardingProfile`: delete `demographic` and `campusId`; add `avatarId: string`, `openToNearby: boolean | null`, `highlights: OnboardingHighlight[]`. In `INITIAL`: `avatarId: randomAvatarId()` (import from `../components/atoms`), `openToNearby: null`, `highlights: []`. NOTE: `INITIAL` is a module constant — dealing the random monster there means every fresh flow gets one; `reset()` should re-deal: change `reset` to `setProfile({ ...INITIAL, avatarId: randomAvatarId() })`, and make `INITIAL.avatarId` just `'monster-01'`.

- [ ] **Step 2: Delete the professor coercion** in `update` (both `demographic` branches, lines 73–87) — `update` becomes the plain setter.

- [ ] **Step 3: Update `hydrate`.** Select becomes `'edu_email, name, avatar_id, vibe_blurb, skills, role, open_to_nearby, github_url, linkedin_url, portfolio_url, resume_url'` (photo_url is no longer selectable — column privilege revoked; demographic/campus_id are dropped). Map `avatarId: data.avatar_id ?? profile.avatarId`, `openToNearby: (data.open_to_nearby as boolean | null) ?? profile.openToNearby`. Delete `photoUri`/`demographic`/`campusId` mappings. Keep `photoUri` field in the type — it now only ever holds a *fresh local* picker URI.

- [ ] **Step 4: Update `submit`.**
  - Delete `resolvedRole` professor logic — use `profile.role` directly.
  - Photo upload block stays, but build the upsert payload so `photo_url` is **only included when a new local photo was picked** (otherwise omitted, never nulled):

```ts
const payload: Record<string, unknown> = {
  id: userId,
  edu_email: profile.eduEmail || userEmail,
  name: profile.name,
  avatar_id: profile.avatarId,
  vibe_blurb: profile.vibeBlurb,
  skills: profile.skills,
  role: profile.role,
  open_to_nearby: profile.openToNearby,
  github_url: profile.proofLinks.github,
  linkedin_url: profile.proofLinks.linkedin,
  portfolio_url: profile.proofLinks.portfolio,
  resume_url: profile.proofLinks.resume,
  updated_at: new Date().toISOString(),
  last_meaningful_action_at: new Date().toISOString(),
};
if (uploadedPhotoUrl !== undefined) payload.photo_url = uploadedPhotoUrl;
```

  where `uploadedPhotoUrl: string | null | undefined` is `undefined` when no local URI was picked, the public URL on upload success, `null` on upload failure (keep the existing toast).
  - After the profile upsert succeeds, insert highlights (failures toast-and-continue, profile already saved):

```ts
for (const [i, h] of profile.highlights.entries()) {
  if (!h.title.trim()) continue;
  try {
    let imageUrl: string | null = null;
    if (h.imageUri) imageUrl = await uploadPortfolioImage(userId, h.id, h.imageUri, Date.now());
    await upsertPortfolioItem({
      userId, id: h.id, title: h.title.trim(),
      description: h.description.trim() || h.title.trim(),
      imageUrl, position: i,
    });
  } catch {
    toast.error(`"${h.title}" didn't save — you can re-add it from your profile`);
  }
}
```

  Import `upsertPortfolioItem, uploadPortfolioImage` from `../lib/portfolio`. (`description` falls back to title because `portfolio_items.description` has a NOT NULL length ≥ 1 check.)

- [ ] **Step 5: Verify** — `npx tsc --noEmit` (WILL still fail in screens that reference deleted fields — that's Tasks 5–7; confirm the *context file itself* has no errors, e.g. `npx tsc --noEmit 2>&1 | grep OnboardingContext` is empty).

- [ ] **Step 6: Commit** — `git commit -m "feat: onboarding context — avatarId, vicinity, highlights; drop demographic/campus"`

---

### Task 5: IdentityScreen (replaces PhotoScreen) + VicinityScreen (replaces CampusScreen)

**Files:**
- Create: `components/organisms/onboarding/IdentityScreen.tsx`
- Create: `components/organisms/onboarding/VicinityScreen.tsx`
- Delete: `components/organisms/onboarding/PhotoScreen.tsx`, `components/organisms/onboarding/CampusScreen.tsx`

**Interfaces:**
- Consumes: `useOnboarding` (Task 4 shape), `Avatar`/`AvatarPickerSheet`, `OnboardingContinue`, `BackChevron`, `KeyboardDismiss`.
- Produces: `IdentityScreen({ onBack, onContinue })`, `VicinityScreen({ onBack, onContinue })` — same prop contract as every onboarding screen.

- [ ] **Step 1: Write `IdentityScreen.tsx`.** Base it on the old `PhotoScreen.tsx` layout (headline + centered visual + name input + anchored continue):
  - Headline: `Meet your mark`.
  - Centered `<Avatar avatarId={profile.avatarId} size={200} />` inside a Pressable that opens `AvatarPickerSheet` (`onSelect={(id) => update('avatarId', id)}`). Under it a small `AmbitFont.body` 13 `Brand.actionDeep` label: `Tap to pick a different monster`.
  - Name `TextInput` — copy the old one verbatim (value/onChangeText/styles).
  - Below the input, an optional photo row (reuse the old `pickFromLibrary`/`takePhoto`/`openPicker` functions verbatim from PhotoScreen): a bordered `Pressable` row, camera icon + text — `profile.photoUri ? 'Photo added — shown after you connect' : 'Add a photo — only shown after someone connects with you'`; when `photoUri` set, show a 40px thumbnail `expo-image` preview in the row.
  - Gate unchanged: `isValid = profile.name.trim().length > 1`.

- [ ] **Step 2: Write `VicinityScreen.tsx`.** Base on CampusScreen's header/watermark structure (kicker `Vicinity`, headline `Work in person?`, subtitle `You can change this anytime from your profile.`) but no ScrollView — exactly two option cards styled like CampusScreen's rows (HardShadow + Pressable + selected fill `Brand.selected`):
  - Card 1: `MapPin` icon, title `In person nearby`, sub `Open to meeting up and working together in person` → `update('openToNearby', true)`
  - Card 2: `Laptop` icon (phosphor), title `Remote only`, sub `Collaborate online, wherever you are` → `update('openToNearby', false)`
  - Gate: `isValid = profile.openToNearby !== null`.

- [ ] **Step 3: Delete `PhotoScreen.tsx` and `CampusScreen.tsx`.** (OnboardingFlow still imports them — fixed in Task 7; expected transient tsc failure.)

- [ ] **Step 4: Verify the two new files typecheck** — `npx tsc --noEmit 2>&1 | grep -E "IdentityScreen|VicinityScreen"` is empty.

- [ ] **Step 5: Commit** — `git commit -m "feat: Identity + Vicinity onboarding screens"`

---

### Task 6: HighlightsScreen (new, skippable)

**Files:**
- Create: `components/organisms/onboarding/HighlightsScreen.tsx`

**Interfaces:**
- Consumes: `useOnboarding` (`profile.highlights`, `update('highlights', …)`), `OnboardingHighlight` type, `randomUUID` from `expo-crypto`, image picker.
- Produces: `HighlightsScreen({ onBack, onContinue })`.

- [ ] **Step 1: Write the screen.**
  - Header: kicker `Highlights`, headline `Show what you've built`, subtitle `Add past projects to your profile — this is what people see first.`
  - List of added highlights (max 3): each a card row with optional 48px image thumb, title, one-line description, and an ✕ remove button (`update('highlights', profile.highlights.filter(h => h.id !== id))`).
  - An inline composer (not a modal): `TextInput` title (placeholder `Project title`, maxLength 60), `TextInput` description (placeholder `One line on what it was`, maxLength 120), an `Add cover` image-picker chip (library only, `allowsEditing`, `aspect [4,3]`, quality 0.85 — same options style as portfolio picking), and an `Add highlight` button enabled when title is non-empty. On add: `update('highlights', [...profile.highlights, { id: randomUUID(), title, description, imageUri }])` then clear the composer. Hide the composer once 3 highlights exist.
  - Footer: `OnboardingContinue` always enabled, `label` `Continue` when `highlights.length > 0`, else `Skip for now` — check `OnboardingContinue`'s props; if it has no label prop, render a secondary text-button `Skip for now` above the Continue and disable Continue when empty instead. Keep it simple: whatever `OnboardingContinue` supports, the screen must ALWAYS offer a way forward with zero highlights.

- [ ] **Step 2: Verify** — `npx tsc --noEmit 2>&1 | grep HighlightsScreen` is empty.

- [ ] **Step 3: Commit** — `git commit -m "feat: Highlights onboarding screen"`

---

### Task 7: OnboardingFlow rewiring + orphan cleanup

**Files:**
- Modify: `components/organisms/OnboardingFlow.tsx`
- Modify: `constants/legal.ts:59` (remove professor mention — reword the line to students only)
- Delete: `components/organisms/onboarding/DemographicScreen.tsx`, `components/organisms/onboarding/VibeBlurbScreen.tsx`, `components/organisms/onboarding/ProofLinksScreen.tsx` (confirm each is unimported first: `grep -rn "VibeBlurbScreen\|ProofLinksScreen\|DemographicScreen" app components context lib`)

**Interfaces:**
- Consumes: `IdentityScreen`, `VicinityScreen`, `HighlightsScreen` (Tasks 5–6).
- Produces: final step machine used by resume logic and progress bar.

- [ ] **Step 1: Update the step machine** in `OnboardingFlow.tsx`:

```ts
const STEPS = [
  'splash', 'welcome', 'preview', 'eduEmail',
  'identity', 'role', 'skills', 'vicinity', 'highlights', 'complete',
] as const;

const PROGRESS_STEPS_ALL: LinearStep[] = [
  'eduEmail', 'identity', 'role', 'skills', 'vicinity', 'highlights',
];

function shouldShow(step: LinearStep, profile: OnboardingProfile, hasSession: boolean): boolean {
  if (step === 'eduEmail' && hasSession) return false;   // unchanged
  if (step === 'skills' && profile.role === 'owner') return false;
  return true;
}

function isComplete(step: LinearStep, profile: OnboardingProfile): boolean {
  switch (step) {
    case 'eduEmail':   return profile.eduEmail.toLowerCase().endsWith('.edu') && profile.eduEmail.includes('@');
    case 'identity':   return profile.name.trim().length > 1;
    case 'role':       return profile.role !== null;
    case 'skills':     return profile.skills.length >= 2;
    case 'vicinity':   return profile.openToNearby !== null;
    // Skippable — must never trap the resume jump.
    case 'highlights': return true;
    case 'splash': case 'welcome': case 'preview': case 'complete': return true;
  }
}
```

  Update imports (remove Demographic/Photo/Campus screens, add Identity/Vicinity/Highlights) and `renderStep` cases accordingly (`identity` → `<IdentityScreen …/>`, `vicinity` → `<VicinityScreen …/>`, `highlights` → `<HighlightsScreen …/>`). Update the STEPS doc comment (lines 44–61) to describe the new spine and drop all professor language.

  **Resume caveat:** because `highlights` is always "complete", `firstIncompleteStep` for a fully-filled resuming user resolves to `complete` — correct (they're dismissed/submitted), and a user who filled vicinity but skipped highlights also resolves to `complete` — also correct (highlights are optional). No change needed, but verify this reasoning holds when reading the final code.

- [ ] **Step 2: Fix `constants/legal.ts`** — reword line 59 to remove "professor"; keep the legal meaning (eligibility = current students with a .edu email).

- [ ] **Step 3: Delete the three orphaned screens** after the grep confirms only OnboardingFlow (Demographic) references remain.

- [ ] **Step 4: Verify** — full `npx tsc --noEmit` now clean across onboarding (context + screens + flow). Run the app (`npx expo start`) and click through onboarding as a new account: splash → … → identity (monster + name + optional photo) → role → (skills if seeker) → vicinity → highlights (skip works, add works) → complete → submits.

- [ ] **Step 5: Commit** — `git commit -m "feat: rewire onboarding — identity/vicinity/highlights, remove professors"`

---

### Task 8: Photo reveal client lib

**Files:**
- Create: `lib/photoReveal.ts`

**Interfaces:**
- Consumes: RPC `fetch_peer_photos(peer_ids uuid[])` (Task 1).
- Produces (chat/profile tasks use this): `fetchPeerPhotos(peerIds: string[]): Promise<Map<string, string>>` — map of userId → photo URL, containing ONLY revealed peers. Never throws (returns empty map on error).

- [ ] **Step 1: Write `lib/photoReveal.ts`**

```ts
import { supabase } from './supabase';

/// The ONLY client read path for other users' photos. The server-side
/// fetch_peer_photos RPC (migration 039) returns a row per peer whose photo
/// the caller is allowed to see: self, or a mutual conversation (both sides
/// have sent a message, thread not passed/auto_declined). Absence from the
/// result means "not revealed" — render the monster mark instead.
export async function fetchPeerPhotos(peerIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (peerIds.length === 0) return out;
  const { data, error } = await supabase.rpc('fetch_peer_photos', {
    peer_ids: Array.from(new Set(peerIds)),
  });
  if (error || !data) return out;
  for (const row of data as { user_id: string; photo_url: string | null }[]) {
    if (row.photo_url) out.set(row.user_id, row.photo_url);
  }
  return out;
}
```

- [ ] **Step 2: Verify** — `npx tsc --noEmit` clean. **Step 3: Commit** — `git commit -m "feat: fetchPeerPhotos reveal client"`

---

### Task 9: Data layer sweep — mock.ts types, feed, SavedDeck

**Files:**
- Modify: `data/mock.ts` — delete `Campus` interface + `CAMPUSES` (lines ~5–31); on `SeekerCardData`: replace `photoUri` with `avatarId: string`, replace campus field with `openToNearby: boolean | null`; on `ProjectCardData`: replace `ownerPhotoUri` with `ownerAvatarId: string`, replace `ownerCampusId` with `ownerOpenToNearby: boolean | null`. Update `MOCK_PROJECTS` + any mock seekers to the new fields (assign varied `monster-NN` ids).
- Modify: `app/(candidate)/(tabs)/feed.tsx` — queries select `avatar_id, open_to_nearby` instead of `photo_url` and campus (lines ~108–145); map into the new card fields.
- Modify: `context/SavedDeckContext.tsx` — same select/mapping swap (lines ~79–144).

**Interfaces:**
- Produces: `SeekerCardData.avatarId`, `SeekerCardData.openToNearby`, `ProjectCardData.ownerAvatarId`, `ProjectCardData.ownerOpenToNearby` — Tasks 10/11/12 consume these exact names.

- [ ] **Step 1: mock.ts edits** (grep for every `CAMPUSES` consumer first — they are fixed in Tasks 10–12; note them for the tracker).
- [ ] **Step 2: feed.tsx + SavedDeckContext.tsx select/mapping swaps.** IMPORTANT: any `profiles` select that still names `photo_url` will now 401 at runtime (column privilege) — grep the whole repo for `photo_url` and list remaining call sites in the task report.
- [ ] **Step 3: Verify** — `npx tsc --noEmit 2>&1 | grep -E "mock|feed|SavedDeck"` empty. **Step 4: Commit** — `git commit -m "feat: card data layer — avatarId/openToNearby replace photo/campus"`

---

### Task 10: DiscoveryCard project-forward + eyebrows

**Files:**
- Modify: `components/molecules/DiscoveryCard.tsx`

**Interfaces:**
- Consumes: Task 9 card fields; `Avatar`, `avatarSource` from atoms; `PortfolioItem[]` already flowing to seeker cards.

- [ ] **Step 1: Seeker card `PhotoPanel` (lines ~256–291, usage ~338):** render, in priority order: (1) first portfolio item with an `imageUri` → full-bleed `expo-image`; (2) else a `Brand.seekerSurface` panel with `<Avatar avatarId={card.avatarId} size={132} />` centered. Delete the `card.photoUri` path.
- [ ] **Step 2: Seeker eyebrow (line ~324):** replace the `CAMPUSES.find` campus name with `card.openToNearby === false ? 'REMOTE' : 'IN PERSON'` (null treated as `IN PERSON`? No — null means unanswered: fall back to the existing secondary eyebrow content and show nothing location-related when null).
- [ ] **Step 3: Project card (lines ~456–493):** fallback chain becomes `card.imageUri` → owner monster: keep the royal→iris gradient backdrop and center `<Avatar avatarId={card.ownerAvatarId} size={96} />` instead of `ownerPhotoUri`/`ownerInitials`. Replace the project eyebrow's campus resolve (~490) with the same IN PERSON/REMOTE rule off `ownerOpenToNearby`.
- [ ] **Step 4: Verify** — tsc clean for the file; run app, confirm seeker cards show highlight image or monster panel, project cards show cover or monster-on-gradient, eyebrows read IN PERSON/REMOTE. **Step 5: Commit** — `git commit -m "feat: project-forward discovery cards with monster marks"`

---

### Task 11: Chat surfaces — monster default, photo reveal on mutual threads

**Files:**
- Modify: `components/molecules/MessageBubble.tsx` (local `Avatar` at ~154–180 → delete; use shared `Avatar`)
- Modify: `components/molecules/InboxRow.tsx` (~216), `components/molecules/PinnedStrip.tsx` (~82), `app/(candidate)/(tabs)/chat/new.tsx` (~319), `app/(candidate)/(tabs)/chat/index.tsx`, `app/(candidate)/(tabs)/chat/[id].tsx` (~1510, 1539), `components/organisms/PartnerProfileIsland.tsx`
- All of these currently read `photo_url`/`photoUri`-shaped props.

**Interfaces:**
- Consumes: `Avatar` atom (`photoUrl` prop), `fetchPeerPhotos` (Task 8), profile selects now returning `avatar_id`.

- [ ] **Step 1: Swap every avatar render site to the shared `<Avatar avatarId={…} photoUrl={revealed.get(peerId) ?? null} size={…} />`.** Where the underlying query selected `photo_url`, select `avatar_id` instead and thread it through the row/props types.
- [ ] **Step 2: Reveal wiring.**
  - `chat/index.tsx` (inbox): after loading conversations, call `fetchPeerPhotos(allPeerIds)` once and pass the map down to `InboxRow`/`PinnedStrip`. Rows without an entry render the monster.
  - `chat/[id].tsx` (thread): call `fetchPeerPhotos([peerId])` on mount AND after sending a message (cheap; the send that makes a thread mutual is the *peer's*, so also refresh when a new incoming message arrives — hook into the existing realtime message handler). Thread header avatar: when the map gains the peer's URL, crossfade monster → photo (`Animated.timing` opacity swap, ~400ms, skip when `useReducedMotion`... RN: use `AccessibilityInfo.isReduceMotionEnabled()` if already used in repo, else just use expo-image's built-in `transition={400}` which handles the fade on source change — preferred, simplest).
  - `chat/new.tsx` search rows + `PartnerProfileIsland`: same pattern — one `fetchPeerPhotos` batch per screen load.
- [ ] **Step 3: Verify** — tsc clean; runtime: one-sided reach-out shows monsters everywhere; after the recipient replies, thread header + inbox row show the photo (test with two seeded accounts). **Step 4: Commit** — `git commit -m "feat: chat reveal — monsters until mutual, photos after"`

---

### Task 12: Profile tab — Change icon / Change photo / vicinity toggle

**Files:**
- Modify: `app/(candidate)/(tabs)/profile.tsx` (avatar render ~572–583, `pickPhoto` ~298–320, "Change/Add photo" ~589, `initial` ~516, campus PickerField ~656–661, `PickerField` campus sheet state)
- Modify: `components/molecules/OwnerProfileCard.tsx` (~53 — owner preview avatar → monster)

**Interfaces:**
- Consumes: `Avatar`, `AvatarPickerSheet`, `fetchPeerPhotos`, `profiles.avatar_id`, `profiles.open_to_nearby`.

- [ ] **Step 1: Hero + rows.** Hero renders `<Avatar avatarId={avatarId} size={96} />` (monster — the public identity). Below it two rows:
  - **"Change icon"** → opens `AvatarPickerSheet`; `onSelect` optimistically sets state and `supabase.from('profiles').update({ avatar_id: id }).eq('id', userId)`.
  - **"Change photo"** → existing `pickPhoto` flow unchanged (upload to `avatars` bucket, update `photo_url`), row sub-copy: `Revealed after you connect`. Next to it show the user's own current photo at 40px — sourced via `fetchPeerPhotos([userId])` on screen load (self is always revealed by the RPC) — falling back to nothing if no photo.
- [ ] **Step 2: Profile query.** The screen's own `profiles` select must swap `photo_url` → `avatar_id, open_to_nearby` (photo comes from the RPC now).
- [ ] **Step 3: Vicinity field.** Replace the campus `PickerField` + campus sheet with a two-option segmented row (same visual pattern the screen already uses for pickers): `In person nearby` / `Remote only`, writing `open_to_nearby` true/false on tap with optimistic update.
- [ ] **Step 4: OwnerProfileCard** — replace `photoUri`-based avatar with `<Avatar avatarId={…} size={…} />` (monster; the preview is what *strangers* see, so never the photo).
- [ ] **Step 5: Verify** — tsc clean; runtime: change icon persists across reload; change photo uploads and own thumbnail shows; vicinity toggle persists; preview card shows monster. **Step 6: Commit** — `git commit -m "feat: profile — change icon, reveal-aware photo row, vicinity toggle"`

---

### Task 13: Remaining surfaces + project-new campus removal

**Files:**
- Modify: `app/(candidate)/project-new.tsx` (delete `campus_id` from the insert ~78–91 and the profile campus fetch ~55)
- Modify: `app/(candidate)/(tabs)/projects.tsx` (collaborator faces ~288–296, seeker engagements ~346–351 → shared `Avatar` with `avatar_id` selects)
- Modify: `app/(candidate)/saved.tsx` (~291), `components/molecules/SavedCarousel.tsx` (~62) → monster avatars via Task 9 card fields
- Modify: `app/(candidate)/project-manage.tsx` (~234 initials fallback → `Avatar`)
- Check (grep, fix if hit): `components/molecules/ContactCardBubble.tsx`, `ReachOutComposer.tsx`, `structuredCard.tsx`, `PortfolioAttachmentBubble.tsx`, `ProjectAttachmentBubble.tsx`, `resume-import.tsx`, `hooks/`, `lib/messaging.ts` for `photo_url`/`photoUri`/`campus`/`CAMPUSES`/`demographic` references

**Interfaces:** consumes everything already built; produces nothing new.

- [ ] **Step 1:** `project-new.tsx` — remove campus fetch + insert field.
- [ ] **Step 2:** Swap remaining avatar sites to shared `Avatar`. These are all pre-connection surfaces — monster only; never pass `photoUrl` here (the viewers are strangers).
- [ ] **Step 3: The final grep sweep** — `grep -rn "photo_url\|photoUri\|CAMPUSES\|campus_id\|campusId\|demographic\|professor" app components context lib data hooks --include="*.ts" --include="*.tsx"` — every remaining hit must be either (a) the reveal lib/profile own-photo path, or (b) deliberately dead (delete it). Report the final hit list.
- [ ] **Step 4: Verify** — FULL `npx tsc --noEmit` clean. Full simulator pass: onboarding (seeker + owner), feed swipe both card kinds, save + saved deck, reach out, two-account reveal check, profile edits, project create/manage. **Step 5: Commit** — `git commit -m "feat: complete avatar/vicinity sweep across remaining surfaces"`

---

## Self-review notes (already applied)

- Spec §1 asset optimization (pngquant) intentionally deferred — bundle size is a nice-to-have; noted in tracker, not a task.
- Reveal-triggering edge: the *peer's first reply* arrives via realtime — Task 11 Step 2 hooks the refresh there so the crossfade happens live.
- `INITIAL.avatarId` random-deal footgun (module-constant evaluated once) — handled in Task 4 Step 1 via `reset()`.
- Migration ordering (RPC redefinitions vs column drops) — flagged inside Task 1 Step 2.
