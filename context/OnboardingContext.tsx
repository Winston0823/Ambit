import React, { createContext, ReactNode, useContext, useState } from 'react';

/// In-memory profile state captured across the onboarding flow.
/// No backend wired — Future: persist via Supabase / SecureStore.

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
}

const OnboardingContext = createContext<Ctx | undefined>(undefined);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<OnboardingProfile>(INITIAL);
  const update: Ctx['update'] = (key, value) =>
    setProfile((p) => ({ ...p, [key]: value }));
  const reset = () => setProfile(INITIAL);
  return (
    <OnboardingContext.Provider value={{ profile, update, reset }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding(): Ctx {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used inside OnboardingProvider');
  return ctx;
}
