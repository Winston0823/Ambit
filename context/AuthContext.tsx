import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from '../lib/supabase';
import { clearBadge, registerForPushNotifications, unregisterAllPushTokens } from '../lib/pushNotifications';

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
  /// Send a password-reset email. Gives existing users an account-recovery
  /// path (audit P0: SignIn "Forgot password?" was a dead button).
  sendPasswordReset: (email: string) => Promise<void>;
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
      if (url.includes('access_token')) {
        const hash = url.split('#')[1] ?? '';
        const params = new URLSearchParams(hash);
        const access_token = params.get('access_token') ?? '';
        const refresh_token = params.get('refresh_token') ?? '';
        if (access_token) await supabase.auth.setSession({ access_token, refresh_token });
      } else if (url.includes('code=')) {
        await supabase.auth.exchangeCodeForSession(url);
      }
    };

    Linking.getInitialURL().then((url) => { if (url) handle(url); });
    const sub = Linking.addEventListener('url', ({ url }) => handle(url));
    return () => sub.remove();
  }, []);

  const redirectTo = Linking.createURL('auth/callback');
  const oauthRedirectTo = 'ambit://auth/callback';

  const signInWithGoogle = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: oauthRedirectTo, skipBrowserRedirect: true },
    });
    if (error) throw error;
    if (data.url) {
      const result = await WebBrowser.openAuthSessionAsync(data.url, oauthRedirectTo);
      if (result.type === 'success') {
        const url = result.url;
        if (url.includes('access_token')) {
          const hash = url.split('#')[1] ?? '';
          const params = new URLSearchParams(hash);
          const access_token = params.get('access_token') ?? '';
          const refresh_token = params.get('refresh_token') ?? '';
          if (access_token) await supabase.auth.setSession({ access_token, refresh_token });
        } else if (url.includes('code=')) {
          await supabase.auth.exchangeCodeForSession(url);
        }
      }
    }
  };

  /// On iOS, use the native Apple Sign-In sheet via expo-apple-authentication
  /// and exchange the resulting identity token directly with Supabase. This
  /// is required by Apple's App Store review guidelines (4.8) for apps that
  /// also offer Google sign-in, and gives a much better UX than the web
  /// OAuth round-trip. On Android / web we fall back to the OAuth flow.
  const signInWithApple = async () => {
    if (Platform.OS === 'ios' && (await AppleAuthentication.isAvailableAsync())) {
      try {
        const credential = await AppleAuthentication.signInAsync({
          requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
          ],
        });
        if (!credential.identityToken) {
          throw new Error('No identity token returned from Apple.');
        }
        const { error } = await supabase.auth.signInWithIdToken({
          provider: 'apple',
          token:    credential.identityToken,
        });
        if (error) throw error;
        return;
      } catch (e: any) {
        // User cancellation surfaces as a specific code; swallow silently
        // so the UI doesn't show a confusing error toast.
        if (e?.code === 'ERR_REQUEST_CANCELED') return;
        throw e;
      }
    }

    // Non-iOS fallback: web OAuth round-trip.
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

  const sendPasswordReset = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    if (error) throw error;
  };

  const signOut = async () => {
    const uid = session?.user?.id;
    if (uid) {
      // Remove all device tokens before signing out so this device stops
      // receiving push notifications once the session ends.
      await unregisterAllPushTokens(uid).catch(() => {});
      await clearBadge();
    }
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
      sendPasswordReset,
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
