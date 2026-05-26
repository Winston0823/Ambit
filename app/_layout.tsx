import React from 'react';
import { StyleSheet } from 'react-native';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
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
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Slot />
    </SafeAreaView>
  ) : (
    <OnboardingInline onComplete={() => { /* AuthContext re-route handles it */ }} />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, backgroundColor: Brand.canvas },
});
