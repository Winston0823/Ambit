import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../lib/supabase';
import { registerForPushNotifications } from '../lib/pushNotifications';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  /// True once we've verified the signed-in user has a row in the profiles
  /// table (onboarding complete). null while the check is in-flight. Drives
  /// the root-level routing decision in app/_layout.tsx.
  hasProfile: boolean | null;
  /// Re-check profile existence (e.g. after the user finishes onboarding).
  refreshProfile: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithEduOtp: (email: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  /// Whenever the signed-in user changes, re-check whether they have a
  /// completed profile row. Single source of truth for the "needs onboarding"
  /// decision. We only select `id` so this stays cheap even on slow networks.
  const checkProfile = async (userId: string | undefined) => {
    if (!userId) { setHasProfile(false); return; }
    setHasProfile(null);
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();
    if (error) {
      // Treat lookup failure as "no profile" so we don't lock the user out of
      // onboarding; they can complete it and we'll upsert.
      setHasProfile(false);
      return;
    }
    setHasProfile(!!data);
  };

  useEffect(() => {
    checkProfile(session?.user?.id);
  }, [session?.user?.id]);

  // Register for push notifications once we have a signed-in user.
  // No-ops cleanly in Expo Go (which can't receive remote push).
  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) return;
    registerForPushNotifications(uid).catch((e) =>
      console.warn('push registration failed:', e?.message ?? e),
    );
  }, [session?.user?.id]);

  const refreshProfile = async () => {
    await checkProfile(session?.user?.id);
  };

  // Handle deep links for OAuth redirects and magic links
  useEffect(() => {
    const handle = async (url: string) => {
      if (url.includes('access_token') || url.includes('code=')) {
        await supabase.auth.exchangeCodeForSession(url);
      }
    };

    Linking.getInitialURL().then((url) => { if (url) handle(url); });
    const sub = Linking.addEventListener('url', ({ url }) => handle(url));
    return () => sub.remove();
  }, []);

  const redirectTo = Linking.createURL('auth/callback');

  const signInWithGoogle = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error) throw error;
    if (data.url) {
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type === 'success') {
        await supabase.auth.exchangeCodeForSession(result.url);
      }
    }
  };

  const signInWithApple = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error) throw error;
    if (data.url) {
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type === 'success') {
        await supabase.auth.exchangeCodeForSession(result.url);
      }
    }
  };

  const signInWithEduOtp = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    if (error) throw error;
  };

  const signUpWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  };

  const signInWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{
      session,
      user: session?.user ?? null,
      loading,
      hasProfile,
      refreshProfile,
      signInWithGoogle,
      signInWithApple,
      signInWithEduOtp,
      signUpWithEmail,
      signInWithEmail,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
