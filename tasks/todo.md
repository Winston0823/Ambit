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
- [ ] **Support email** — create the real `support@ambit.app` (or chosen) inbox. It's referenced in the finalized Privacy Policy + Terms and is the destination for privacy/support/UGC-report questions. Then set `LEGAL_CONTACT_EMAIL` in `constants/legal.ts` to match and re-export the docx. **REQUIRED before submission** (App Store needs a working support contact).
- [~] **Privacy Policy** — DONE in-app (Apple-style Terms + Privacy in `constants/legal.ts`, `LegalModal` viewer, agree-gate on WelcomeScreen, links on profile). v1 finalized in Downloads. REMAINING: host both docs at a public URL, then set `LEGAL_URLS` in `constants/legal.ts` + the Privacy Policy URL in App Store Connect.
- [x] **Rewarded-ad system (real)** — wired real AdMob (`lib/ads.ts` + `react-native-google-mobile-ads`); `ReachOutLimitSheet` grants only on `EARNED_REWARD`. ATT prompt + `NSUserTrackingUsageDescription` added. Real iOS App ID + ad-unit ID in place; Android unit still a placeholder.

## External — App Store Connect data entry (not code)
Privacy questionnaire · screenshots (6.9"+6.5"; iPad 13" unless supportsTablet:false) · category · age rating · description/keywords · support+marketing URL · privacy policy URL · reviewer demo account · APNs key.
