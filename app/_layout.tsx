import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet } from 'react-native';
import { router, Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import * as Notifications from 'expo-notifications';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_600SemiBold,
} from '@expo-google-fonts/playfair-display';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { SavedDeckProvider } from '../context/SavedDeckContext';
import { Brand } from '../constants/theme';
import { OnboardingInline, ToastHost } from '../components/organisms';
import Constants from 'expo-constants';
import { useProfileRole } from '../hooks/useProfileRole';
import { clearBadge } from '../lib/pushNotifications';
import { touchPresence } from '../lib/presence';
import { supabase } from '../lib/supabase';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlayfairDisplay_400Regular,
    PlayfairDisplay_600SemiBold,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
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
          <SavedDeckProvider>
            <StatusBar style="dark" />
            <Gate />
            {/* Single app-wide toast surface — overlays onboarding + app so
                any layer's toast.error(...) is visible (audit theme 1). */}
            <ToastHost />
          </SavedDeckProvider>
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
  const { user } = useAuth();
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
    const isOwner = role === 'owner';
    router.push({
      pathname: isOwner ? '/(founder)/(tabs)/chat/[id]' : '/(candidate)/(tabs)/chat/[id]',
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
      if (state === 'active') {
        clearBadge();
        if (user?.id) touchPresence(user.id);
      }
    });
    return () => sub.remove();
  }, [user?.id]);

  // ── Realtime local-notification fallback ────────────────────────────
  // iOS Simulator and Expo Go can't receive remote APNs push notifications.
  // Subscribe to message inserts via Supabase Realtime and schedule a local
  // notification instead. Local notifications display as full banners,
  // and tapping them routes through the existing navigateToConversation path.
  //
  // Skipped on native builds (appOwnership !== 'expo') because the Edge
  // Function handles delivery there — running both would double-notify.
  useEffect(() => {
    if (!user || Constants.appOwnership !== 'expo') return;

    // Adopt an existing live channel if one's already registered (fast-refresh
    // / remount) — .on() after subscribe() throws, so only wire + subscribe +
    // tear down a channel we create.
    const topic = 'notification-local-fallback';
    const existing = supabase
      .getChannels()
      .find((c) => c.topic === `realtime:${topic}`);
    if (existing) return () => {};

    const ch = supabase
      .channel(topic)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `sender_id=neq.${user.id}`,
        },
        async (payload) => {
          const msg = payload.new as {
            id: string;
            conversation_id: string;
            sender_id: string;
            body: string | null;
            attachment_url: string | null;
            kind: string | null;
            deleted_at: string | null;
          };
          if (msg.deleted_at || msg.kind === 'system') return;

          // Fetch sender name + project title in parallel for the banner copy.
          const [{ data: sender }, { data: convo }] = await Promise.all([
            supabase.from('profiles').select('name').eq('id', msg.sender_id).maybeSingle(),
            supabase
              .from('conversations')
              .select('projects(title)')
              .eq('id', msg.conversation_id)
              .maybeSingle(),
          ]);

          const preview = msg.body
            ? (msg.body.length > 100 ? msg.body.slice(0, 97) + '…' : msg.body)
            : msg.attachment_url ? '📎 Photo' : 'New message';
          // Supabase joins can return an object or an array depending on the
          // schema introspection — normalise both shapes.
          const pr = convo?.projects as any;
          const projectTitle = (pr?.title ?? pr?.[0]?.title) as string | undefined;
          const body = projectTitle ? `re: ${projectTitle} — ${preview}` : preview;

          await Notifications.scheduleNotificationAsync({
            content: {
              title: sender?.name ?? 'New message',
              body,
              data: { conversationId: msg.conversation_id, messageId: msg.id },
              sound: 'default',
            },
            trigger: null, // fire immediately
          });
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

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
