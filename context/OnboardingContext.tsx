import React, { createContext, ReactNode, useContext, useState } from 'react';
import { supabase } from '../lib/supabase';

export type Role = 'owner' | 'seeker' | 'both';

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
}

const OnboardingContext = createContext<Ctx | undefined>(undefined);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<OnboardingProfile>(INITIAL);

  const update: Ctx['update'] = (key, value) =>
    setProfile((p) => ({ ...p, [key]: value }));

  const reset = () => setProfile(INITIAL);

  const submit = async (userId: string, userEmail?: string) => {
    let photoUrl: string | null = profile.photoUri;

    if (profile.photoUri?.startsWith('file://') || profile.photoUri?.startsWith('content://')) {
      const ext = profile.photoUri.split('.').pop()?.toLowerCase() ?? 'jpg';
      const path = `${userId}/avatar.${ext}`;
      const response = await fetch(profile.photoUri);
      const blob = await response.blob();
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, blob, { upsert: true, contentType: `image/${ext}` });
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
    });
    if (upsertError) throw upsertError;
  };

  return (
    <OnboardingContext.Provider value={{ profile, update, reset, submit }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding(): Ctx {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used inside OnboardingProvider');
  return ctx;
}
