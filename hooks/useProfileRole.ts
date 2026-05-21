import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import type { Role } from '../context/OnboardingContext';

/// Module-scope cache keyed by user id so navigating between tabs doesn't
/// re-fire the Supabase round-trip every time the feed mounts. Resets when
/// the user signs out (next sign-in writes a fresh entry).
const cache = new Map<string, Role | null>();

interface UseProfileRoleResult {
  role: Role | null;
  loading: boolean;
}

/// One-shot read of the signed-in user's role from the profiles table.
/// Used by Discovery feed to pick the seeker-vs-project card variant.
///
/// While loading or before the user has a profile row, returns
/// `{ role: null, loading: true }` — callers should render a skeleton in
/// that state, not a wrong-variant card.
export function useProfileRole(): UseProfileRoleResult {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  // Seed from cache so a tab switch is instant.
  const cached = userId ? cache.get(userId) ?? null : null;
  const [role, setRole] = useState<Role | null>(cached);
  const [loading, setLoading] = useState<boolean>(!!userId && !cache.has(userId));

  useEffect(() => {
    if (!userId) {
      setRole(null);
      setLoading(false);
      return;
    }
    if (cache.has(userId)) {
      setRole(cache.get(userId) ?? null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const next = (data?.role as Role | null) ?? null;
        cache.set(userId, next);
        setRole(next);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { role, loading };
}
