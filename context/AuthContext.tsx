import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
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
  /// Resolves `true` when the sign-up established an active session, `false`
  /// when Supabase requires email confirmation first (no session yet). Callers
  /// must NOT advance the flow on `false` — there's no authenticated user to
  /// submit a profile for. (Audit P1: email-confirmation void.)
  signUpWithEmail: (email: string, password: string) => Promise<boolean>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  /// Send a password-reset email. Gives existing users an account-recovery
  /// path (audit P0: SignIn "Forgot password?" was a dead button).
  sendPasswordReset: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  /// Permanently delete the signed-in user's account + all their data
  /// (App Store Guideline 5.1.1(v)). Calls the `delete-account` edge
  /// function, then clears the local session. Throws on failure so the
  /// caller can surface an error and NOT navigate away.
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/// Static deep-link target for the native OAuth round-trip. Module-level so it
/// never changes identity across renders (keeps the memoized callbacks stable).
const oauthRedirectTo = 'ambit://auth/callback';

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
  const checkProfile = useCallback(async (userId: string | undefined) => {
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
  }, []);

  useEffect(() => {
    checkProfile(session?.user?.id);
  }, [session?.user?.id, checkProfile]);

  // Register for push notifications once we have a signed-in user.
  // No-ops cleanly in Expo Go (which can't receive remote push).
  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) return;
    registerForPushNotifications(uid).catch((e) =>
      console.warn('push registration failed:', e?.message ?? e),
    );
  }, [session?.user?.id]);

  const refreshProfile = useCallback(async () => {
    await checkProfile(session?.user?.id);
  }, [checkProfile, session?.user?.id]);

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

  const redirectTo = useMemo(() => Linking.createURL('auth/callback'), []);

  const signInWithGoogle = useCallback(async () => {
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
  }, []);

  /// On iOS, use the native Apple Sign-In sheet via expo-apple-authentication
  /// and exchange the resulting identity token directly with Supabase. This
  /// is required by Apple's App Store review guidelines (4.8) for apps that
  /// also offer Google sign-in, and gives a much better UX than the web
  /// OAuth round-trip. On Android / web we fall back to the OAuth flow.
  const signInWithApple = useCallback(async () => {
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
  }, [redirectTo]);

  const signInWithEduOtp = useCallback(async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    if (error) throw error;
  }, [redirectTo]);

  const signUpWithEmail = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    // No session ⇒ Supabase is configured to require email confirmation.
    // Signal that to the caller so it can hold the flow on a "check your
    // inbox" state instead of advancing to a submit with no authed user.
    return data.session != null;
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    if (error) throw error;
  }, [redirectTo]);

  const signOut = useCallback(async () => {
    const uid = session?.user?.id;
    if (uid) {
      // Remove all device tokens before signing out so this device stops
      // receiving push notifications once the session ends.
      await unregisterAllPushTokens(uid).catch(() => {});
      await clearBadge();
    }
    await supabase.auth.signOut();
  }, [session?.user?.id]);

  const deleteAccount = useCallback(async () => {
    const uid = session?.user?.id;
    if (uid) {
      // Stop this device's pushes first (the push_tokens rows also cascade
      // on the server delete, but this clears the device-side badge/token now).
      await unregisterAllPushTokens(uid).catch(() => {});
      await clearBadge();
    }
    // The user's JWT is sent automatically by supabase-js; the function
    // resolves the caller from it and deletes only that user.
    const { error } = await supabase.functions.invoke('delete-account');
    if (error) throw error;
    // Server-side session is already invalid; clear the local one too.
    await supabase.auth.signOut();
  }, [session?.user?.id]);

  const value = useMemo<AuthContextValue>(() => ({
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
    deleteAccount,
  }), [
    session,
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
    deleteAccount,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
