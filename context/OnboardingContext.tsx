import React, { createContext, ReactNode, useContext, useState } from 'react';
import { supabase } from '../lib/supabase';
import { readLocalFileAsArrayBuffer } from '../lib/messaging';

export type Role = 'owner' | 'seeker';

/// Who is on the platform. Students are the primary v1 audience; professors
/// join to recruit students into research projects, so they live alongside.
export type Demographic = 'student' | 'professor';

export interface OnboardingProfile {
  // Eligibility
  eduEmail: string;
  demographic: Demographic | null;

  // Identity
  name: string;
  photoUri: string | null;

  // Personality + capability
  vibeBlurb: string;
  skills: string[];

  // Proximity
  campusId: string | null;

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
  demographic: null,
  name: '',
  photoUri: null,
  vibeBlurb: '',
  skills: [],
  campusId: null,
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
  const [profile, setProfile] = useState<OnboardingProfile>(INITIAL);

  const update: Ctx['update'] = (key, value) =>
    setProfile((p) => ({ ...p, [key]: value }));

  const reset = () => setProfile(INITIAL);

  const hydrate = async (userId: string): Promise<OnboardingProfile> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('edu_email, demographic, name, vibe_blurb, skills, role, campus_id, photo_url, github_url, linkedin_url, portfolio_url, resume_url')
      .eq('id', userId)
      .maybeSingle();
    if (error || !data) return profile;
    const merged: OnboardingProfile = {
      ...profile,
      eduEmail: data.edu_email ?? profile.eduEmail,
      demographic: (data.demographic as Demographic | null) ?? profile.demographic,
      name: data.name ?? profile.name,
      photoUri: data.photo_url ?? profile.photoUri,
      vibeBlurb: data.vibe_blurb ?? profile.vibeBlurb,
      skills: data.skills ?? profile.skills,
      campusId: data.campus_id ?? profile.campusId,
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
    let photoUrl: string | null = profile.photoUri;

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
        photoUrl = data.publicUrl;
      }
    }

    const { error: upsertError } = await supabase.from('profiles').upsert({
      id: userId,
      edu_email: profile.eduEmail || userEmail,
      demographic: profile.demographic,
      name: profile.name,
      vibe_blurb: profile.vibeBlurb,
      skills: profile.skills,
      role: profile.role,
      campus_id: profile.campusId,
      photo_url: photoUrl,
      github_url: profile.proofLinks.github,
      linkedin_url: profile.proofLinks.linkedin,
      portfolio_url: profile.proofLinks.portfolio,
      resume_url: profile.proofLinks.resume,
      updated_at: new Date().toISOString(),
      last_meaningful_action_at: new Date().toISOString(),
    });
    if (upsertError) throw upsertError;

    // Fire-and-forget: generate vibe embedding via Edge Function.
    // Failures are non-fatal — the profile is already saved.
    if (profile.vibeBlurb.trim().length > 0) {
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      fetch(`${supabaseUrl}/functions/v1/embed-vibe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table: 'profiles', id: userId, text: profile.vibeBlurb }),
      }).catch(() => {/* non-blocking */});
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
