import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet } from 'react-native';
import { router, Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import * as Notifications from 'expo-notifications';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { RoleProvider } from '../context/RoleContext';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { SavedDeckProvider } from '../context/SavedDeckContext';
import { Brand } from '../constants/theme';
import { OnboardingInline } from '../components/organisms';
import { useProfileRole } from '../hooks/useProfileRole';
import { clearBadge } from '../lib/pushNotifications';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'Zodiak-Bold': require('../assets/fonts/Zodiak-Bold.otf'),
    'PlusJakartaSans-Regular': require('../assets/fonts/PlusJakartaSans-Regular.otf'),
  });

  // Edge-to-edge: set the root window background once at app start so
  // the OS-level container is transparent. Without this, iOS / Expo Go
  // hosts the React Native scene inside a UIView whose default
  // backgroundColor is white — which shows through as a sliver above
  // any non-white screen's safe-area inset.
  useEffect(() => {
    SystemUI.setBackgroundColorAsync('transparent').catch(() => {});
  }, []);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <AuthProvider>
          <RoleProvider>
            <SavedDeckProvider>
              <StatusBar style="dark" />
              <Gate />
            </SavedDeckProvider>
          </RoleProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/// Root routing decision based on auth state.
///
/// OnboardingInline stays mounted **persistently** until we're sure the
/// signed-in user has a complete profile (`user != null && hasProfile === true`).
/// Any earlier conditional switch — e.g. unmounting during the transient
/// `hasProfile === null` window that opens right after sign-up — would tear
/// down the `OnboardingProvider` mid-flow, throwing away the email/password
/// the user just typed and remounting a fresh splash.
///
/// On cold boot, OnboardingInline mounts immediately so the splash plays;
/// once the profile check resolves to `true`, Gate flips to the main app
/// and the splash unmounts mid-animation.
function Gate() {
  const { user, hasProfile, loading } = useAuth();

  const showMainApp = !loading && user != null && hasProfile === true;

  return showMainApp ? (
    // Root drops the top inset — each top-level screen wraps its own
    // SafeAreaView with its own bg color, so the inset region paints
    // whatever that screen needs (cream for chat, white for feed, etc.)
    // and there's never an extra white sliver above a colored canvas.
    <SafeAreaView style={styles.safe} edges={[]}>
      <NotificationHandler />
      <Slot />
    </SafeAreaView>
  ) : (
    <OnboardingInline onComplete={() => { /* AuthContext re-route handles it */ }} />
  );
}

/// Mounts inside Gate (only when user is authenticated + has profile).
/// Handles three notification scenarios:
///   1. Cold start — app was launched by tapping a notification banner.
///      `getLastNotificationResponseAsync` returns the triggering response.
///   2. Background tap — user taps a banner while app is backgrounded.
///      `addNotificationResponseReceivedListener` fires immediately.
///   3. App foregrounded — clear the badge regardless of how the user
///      opened the app, so iOS/Android badges stay honest.
///
/// Navigation defers until `useProfileRole` resolves so the push lands
/// in the correct route group (founder vs. candidate).
function NotificationHandler() {
  const { role, loading: roleLoading } = useProfileRole();
  const [pendingConvId, setPendingConvId] = useState<string | null>(null);
  // Track whether we already handled the cold-start response so we don't
  // re-navigate on every re-render while role is still loading.
  const coldStartHandled = useRef(false);

  const navigateToConversation = useCallback((conversationId: string) => {
    // Defer if role hasn't resolved yet — store and retry in the effect below.
    if (roleLoading) {
      setPendingConvId(conversationId);
      return;
    }
    const isOwner = role === 'owner' || role === 'both';
    router.push({
      pathname: isOwner ? '/(founder)/chat/[id]' : '/(candidate)/chat/[id]',
      params: { id: conversationId },
    });
    clearBadge();
  }, [role, roleLoading]);

  // Once role loads, drain any pending cold-start navigation.
  useEffect(() => {
    if (!roleLoading && pendingConvId) {
      navigateToConversation(pendingConvId);
      setPendingConvId(null);
    }
  }, [roleLoading, pendingConvId, navigateToConversation]);

  // Cold start: app launched by tapping a notification.
  useEffect(() => {
    if (coldStartHandled.current) return;
    coldStartHandled.current = true;
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      const convId = (response.notification.request.content.data as Record<string, unknown>)
        ?.conversationId as string | undefined;
      if (convId) navigateToConversation(convId);
    });
  }, [navigateToConversation]);

  // Background/foreground tap: fired while the app is already running.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const convId = (response.notification.request.content.data as Record<string, unknown>)
        ?.conversationId as string | undefined;
      if (convId) navigateToConversation(convId);
    });
    return () => sub.remove();
  }, [navigateToConversation]);

  // Clear badge whenever the app comes back to the foreground — the user
  // has opened the app so the "unread" signal is no longer needed.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') clearBadge();
    });
    return () => sub.remove();
  }, []);

  return null;
}

const styles = StyleSheet.create({
  // GestureHandlerRootView's white background is the global fallback —
  // it only shows when a child screen is itself transparent (which
  // shouldn't happen in practice).
  root: { flex: 1, backgroundColor: Brand.canvas },
  // Root SafeAreaView is fully transparent and adds no edge padding.
  // Each top-level screen owns its safe-area handling so the inset
  // region matches that screen's surface color.
  safe: { flex: 1, backgroundColor: 'transparent' },
});
