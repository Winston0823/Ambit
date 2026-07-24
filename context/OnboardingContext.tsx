import React, { createContext, ReactNode, useContext, useState } from 'react';
import { supabase } from '../lib/supabase';
import { readLocalFileAsArrayBuffer } from '../lib/messaging';
import { setProfileRoleCache } from '../hooks/useProfileRole';
import { toast } from '../lib/toast';
import { randomAvatarId } from '../components/atoms';
import { upsertPortfolioItem, uploadPortfolioImage } from '../lib/portfolio';

export type Role = 'owner' | 'seeker';

/// A portfolio highlight collected during onboarding. `id` is a client-side
/// UUID (expo-crypto randomUUID, minted by the highlight screen); `imageUri`
/// holds a local picker URI that is uploaded to storage at submit time.
export interface OnboardingHighlight {
  id: string;
  title: string;
  description: string;
  imageUri: string | null;
}

export interface OnboardingProfile {
  // Eligibility
  eduEmail: string;

  // Identity
  name: string;
  /// Short professional line shown under the name on the discovery card —
  /// "Full-stack & ML Engineer". Optional; '' = unset.
  headline: string;
  avatarId: string;
  photoUri: string | null;

  // Personality + capability
  vibeBlurb: string;
  skills: string[];

  // Proximity — opt-in to surfacing nearby matches (null = undecided)
  openToNearby: boolean | null;

  // Portfolio — uploaded as portfolio_items at submit time
  highlights: OnboardingHighlight[];

  // Validation
  proofLinks: {
    github: string;
    linkedin: string;
    portfolio: string;
    resume: string;
  };

  // Intent — toggleable later in profile menu
  role: Role | null;
}

const INITIAL: OnboardingProfile = {
  eduEmail: '',
  name: '',
  headline: '',
  avatarId: 'monster-01',
  photoUri: null,
  vibeBlurb: '',
  skills: [],
  openToNearby: null,
  highlights: [],
  proofLinks: { github: '', linkedin: '', portfolio: '', resume: '' },
  role: 'seeker',
};

interface Ctx {
  profile: OnboardingProfile;
  update: <K extends keyof OnboardingProfile>(key: K, value: OnboardingProfile[K]) => void;
  reset: () => void;
  submit: (userId: string, userEmail?: string) => Promise<void>;
  /// Hydrate the in-memory profile from a partial Supabase row. Returns the
  /// resolved profile so callers (e.g. OnboardingFlow's "resume at first
  /// incomplete step" logic) can read the hydrated values immediately
  /// without waiting for a React re-render.
  hydrate: (userId: string) => Promise<OnboardingProfile>;
}

const OnboardingContext = createContext<Ctx | undefined>(undefined);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<OnboardingProfile>(() => ({ ...INITIAL, avatarId: randomAvatarId() }));

  const update: Ctx['update'] = (key, value) =>
    setProfile((p) => ({ ...p, [key]: value }));

  // Re-deal a fresh random avatar so a new flow doesn't reuse the last one.
  const reset = () => setProfile({ ...INITIAL, avatarId: randomAvatarId() });

  const hydrate = async (userId: string): Promise<OnboardingProfile> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('edu_email, name, headline, avatar_id, vibe_blurb, skills, role, open_to_nearby, github_url, linkedin_url, portfolio_url, resume_url')
      .eq('id', userId)
      .maybeSingle();
    if (error || !data) return profile;
    const merged: OnboardingProfile = {
      ...profile,
      eduEmail: data.edu_email ?? profile.eduEmail,
      name: data.name ?? profile.name,
      headline: data.headline ?? profile.headline,
      avatarId: data.avatar_id ?? profile.avatarId,
      vibeBlurb: data.vibe_blurb ?? profile.vibeBlurb,
      skills: data.skills ?? profile.skills,
      openToNearby: (data.open_to_nearby as boolean | null) ?? profile.openToNearby,
      role: (data.role as Role | null) ?? profile.role,
      proofLinks: {
        github: data.github_url ?? profile.proofLinks.github,
        linkedin: data.linkedin_url ?? profile.proofLinks.linkedin,
        portfolio: data.portfolio_url ?? profile.proofLinks.portfolio,
        resume: data.resume_url ?? profile.proofLinks.resume,
      },
    };
    setProfile(merged);
    return merged;
  };

  const submit = async (userId: string, userEmail?: string) => {
    // `undefined` when no local URI was picked (photo_url omitted from the
    // payload, never nulled); the public URL on upload success; `null` on
    // upload failure (drop the local-only file:// URI so other users' decks
    // don't render a broken image).
    let uploadedPhotoUrl: string | null | undefined;

    if (profile.photoUri?.startsWith('file://') || profile.photoUri?.startsWith('content://')) {
      // ArrayBuffer route — fetch().blob() silently 0-bytes on RN.
      // See readLocalFileAsArrayBuffer in lib/messaging.ts.
      const ext = profile.photoUri.split('.').pop()?.toLowerCase() ?? 'jpg';
      const path = `${userId}/avatar.${ext}`;
      const bytes = await readLocalFileAsArrayBuffer(profile.photoUri);
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, bytes, { upsert: true, contentType: `image/${ext}` });
      if (!uploadError) {
        const { data } = supabase.storage.from('avatars').getPublicUrl(path);
        uploadedPhotoUrl = data.publicUrl;
      } else {
        uploadedPhotoUrl = null;
        toast.error("Photo didn't upload — you can add it later from your profile");
      }
    }

    const payload: Record<string, unknown> = {
      id: userId,
      edu_email: profile.eduEmail || userEmail,
      name: profile.name,
      headline: profile.headline.trim(),
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

    const { error: upsertError } = await supabase.from('profiles').upsert(payload);
    if (upsertError) throw upsertError;

    // Profile is saved — insert highlights as portfolio_items. Failures
    // toast-and-continue: the profile is already persisted, and the user can
    // re-add any dropped highlight from their profile.
    for (const [i, h] of profile.highlights.entries()) {
      if (!h.title.trim()) continue;
      try {
        let imageUrl: string | null = null;
        if (h.imageUri) imageUrl = await uploadPortfolioImage(userId, h.id, h.imageUri, Date.now());
        await upsertPortfolioItem({
          userId,
          id: h.id,
          title: h.title.trim(),
          // portfolio_items.description has a NOT NULL length ≥ 1 check.
          description: h.description.trim() || h.title.trim(),
          imageUrl,
          position: i,
        });
      } catch {
        toast.error(`"${h.title}" didn't save — you can re-add it from your profile`);
      }
    }

    // Write-through to the role cache so the app routes on the fresh role
    // immediately (the cache may hold a stale `null` from before the
    // profile row existed).
    setProfileRoleCache(userId, profile.role);

    // Fire-and-forget: generate vibe embedding via Edge Function.
    // Failures are non-fatal — the profile is already saved. Use invoke()
    // (not raw fetch) so the caller's JWT is attached — embed-vibe now
    // requires auth + ownership, and the row id here IS the user id.
    if (profile.vibeBlurb.trim().length > 0) {
      supabase.functions
        .invoke('embed-vibe', {
          body: { table: 'profiles', id: userId, text: profile.vibeBlurb },
        })
        .catch(() => {/* non-blocking */});
    }
  };

  return (
    <OnboardingContext.Provider value={{ profile, update, reset, submit, hydrate }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding(): Ctx {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used inside OnboardingProvider');
  return ctx;
}
