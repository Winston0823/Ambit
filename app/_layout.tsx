import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { RoleProvider } from '../context/RoleContext';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { SavedDeckProvider } from '../context/SavedDeckContext';
import { Brand } from '../constants/theme';
import { DebugMenuButton, DebugMenuSheet } from '../components/molecules';
import { OnboardingFlow, OnboardingInline } from '../components/organisms';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'Zodiak-Bold': require('../assets/fonts/Zodiak-Bold.otf'),
    'PlusJakartaSans-Regular': require('../assets/fonts/PlusJakartaSans-Regular.otf'),
  });

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

/// Root routing decision based on auth state:
///   - auth.loading            → blank canvas (avoids one-frame flicker; the
///                                inline OnboardingFlow opens with its own
///                                splash so we don't need a separate one)
///   - no user OR no profile   → OnboardingInline (the actual entry point)
///   - user + profile complete → the candidate app
/// Debug menu still works in both states for dev re-onboarding.
function Gate() {
  const { user, hasProfile, loading } = useAuth();
  const [debugOpen, setDebugOpen] = useState(false);
  const [debugOnboardingOpen, setDebugOnboardingOpen] = useState(false);

  const needsOnboarding = !loading && (!user || hasProfile === false);
  // While we're still resolving auth state, render nothing. The inline
  // OnboardingFlow includes its own SplashScreen so there's no double-splash.
  const resolving = loading || (user && hasProfile === null);

  return (
    <>
      {resolving ? (
        <View style={styles.safe} />
      ) : needsOnboarding ? (
        <OnboardingInline onComplete={() => { /* AuthContext re-route handles it */ }} />
      ) : (
        <SafeAreaView style={styles.safe} edges={['top']}>
          <Slot />
        </SafeAreaView>
      )}

      <DebugMenuButton onPress={() => setDebugOpen(true)} />

      <DebugMenuSheet
        visible={debugOpen}
        onClose={() => setDebugOpen(false)}
        onStartOnboarding={() => {
          setDebugOpen(false);
          setTimeout(() => setDebugOnboardingOpen(true), 200);
        }}
      />

      <OnboardingFlow
        visible={debugOnboardingOpen}
        onDismiss={() => setDebugOnboardingOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, backgroundColor: Brand.canvas },
});
