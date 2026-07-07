# App Store Readiness — Action Plan (2026-07-04)

Audit summary lives in Obsidian: `Ambit/Decisions/App Store Readiness Audit.md`.

## Repo fixes (this pass)
- [x] **Gap 3 — iOS usage strings.** Add `ios.infoPlist` (NSCameraUsageDescription, NSPhotoLibraryUsageDescription, ITSAppUsesNonExemptEncryption:false) + `ios.buildNumber` + register `expo-image-picker` plugin with permission copy.
- [~] **Gap 4 — EAS build/submit config.** Scaffold `eas.json` (production build + submit profiles). ⚠️ `eas init` (writes `extra.eas.projectId`) needs interactive login — flagged for Winston.
- [x] **Secrets hygiene.** `.env` is committed (anon key only, safe). gitignore it, `git rm --cached .env`, add `.env.example`.

## Gap 1 — Account deletion (Guideline 5.1.1(v)) — BUILD NOW
- [x] `supabase/functions/delete-account` edge fn: verify caller JWT → `auth.admin.deleteUser` (DB cascades) + best-effort storage cleanup (avatars/project-images/portfolio-images/resumes, all keyed `<userId>/…`).
- [x] `AuthContext.deleteAccount()` → invoke fn, then local sign-out.
- [x] Profile "Delete account" danger button (double-confirm) at bottom of edit form.

## Polish
- [x] Delete unused `components/molecules/DebugMenu.tsx` + barrel export.
- [x] Add user-facing toast to the two silent permission denials (ChatComposer, PortfolioModal).
- [x] Strip `console.*` from release builds via `babel-plugin-transform-remove-console` (production env only).

## TODOs (tracked, not done this pass)
- [ ] **Privacy Policy** — host a policy page + link it in onboarding/sign-in, and add the URL in App Store Connect. **REQUIRED before submission.**
- [ ] **Rewarded-ad system (real)** — `ReachOutLimitSheet.tsx` currently grants the extra reach-out via a stub. Wire real AdMob (react-native-google-mobile-ads). NOTE: adding ads pulls in IDFA → ATT prompt + `NSUserTrackingUsageDescription` become required.

## External — App Store Connect data entry (not code)
Privacy questionnaire · screenshots (6.9"+6.5"; iPad 13" unless supportsTablet:false) · category · age rating · description/keywords · support+marketing URL · privacy policy URL · reviewer demo account · APNs key.
