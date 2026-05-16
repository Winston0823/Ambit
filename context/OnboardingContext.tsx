import React, { createContext, ReactNode, useContext, useState } from 'react';

/// In-memory profile state captured across the onboarding flow.
/// No backend wired — Future: persist via Supabase / SecureStore.

export type Role = 'owner' | 'seeker' | 'both';

export interface OnboardingProfile {
  eduEmail: string;
  age: number;
  vibeBlurb: string;
  skills: string[];
  role: Role | null;
  campusId: string | null;
  photoUri: string | null;
  proofLinks: {
    github: string;
    linkedin: string;
    portfolio: string;
    resume: string;
  };
}

const INITIAL: OnboardingProfile = {
  eduEmail: '',
  age: 18,
  vibeBlurb: '',
  skills: [],
  role: 'seeker',
  campusId: null,
  photoUri: null,
  proofLinks: { github: '', linkedin: '', portfolio: '', resume: '' },
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
