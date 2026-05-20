import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { RoleProvider } from '../context/RoleContext';
import { AuthProvider } from '../context/AuthContext';
import { Brand } from '../constants/theme';
import { DebugMenuButton, DebugMenuSheet } from '../components/molecules';
import { OnboardingFlow } from '../components/organisms';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'Zodiak-Bold': require('../assets/fonts/Zodiak-Bold.otf'),
    'PlusJakartaSans-Regular': require('../assets/fonts/PlusJakartaSans-Regular.otf'),
  });

  const [debugOpen, setDebugOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <AuthProvider>
          <RoleProvider>
            <StatusBar style="dark" />
            <SafeAreaView style={styles.safe} edges={['top']}>
              <Slot />
            </SafeAreaView>

            <DebugMenuButton onPress={() => setDebugOpen(true)} />

            <DebugMenuSheet
              visible={debugOpen}
              onClose={() => setDebugOpen(false)}
              onStartOnboarding={() => {
                setDebugOpen(false);
                setTimeout(() => setOnboardingOpen(true), 200);
              }}
            />

            <OnboardingFlow
              visible={onboardingOpen}
              onDismiss={() => setOnboardingOpen(false)}
            />
          </RoleProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, backgroundColor: Brand.canvas },
});
