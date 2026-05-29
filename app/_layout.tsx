import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { RoleProvider } from '../context/RoleContext';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { SavedDeckProvider } from '../context/SavedDeckContext';
import { Brand } from '../constants/theme';
import { OnboardingInline } from '../components/organisms';

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
      <Slot />
    </SafeAreaView>
  ) : (
    <OnboardingInline onComplete={() => { /* AuthContext re-route handles it */ }} />
  );
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
