import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackChevron, Button, KeyboardDismiss } from '../../atoms';
import { ANCHORED_CTA_BOTTOM } from '../../molecules/OnboardingContinue';
import { Brand, AmbitFont, Radii, Space } from '../../../constants/theme';

interface Props {
  /// Back to welcome (the user changed their mind and wants to create
  /// an account instead).
  onBack: () => void;
  /// Auth succeeded — dismiss the entire onboarding flow and land them
  /// on the discovery feed.
  onSignedIn: () => void;
}

/// Sign-in branch (returning user). Lives outside the linear STEPS array;
/// reached from WelcomeScreen's "Sign in" CTA. No backend wired — for now
/// "Sign in" treats any valid-looking email + password ≥ 6 chars as success.
/// Wire to Supabase Auth (or Clerk) when auth lands.
export function SignInScreen({ onBack, onSignedIn }: Props) {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const isValid =
    email.includes('@') && email.includes('.') && password.length >= 6;

  return (
    <KeyboardDismiss>
      <SafeAreaView style={styles.root}>
        <BackChevron onPress={onBack} />

        <View style={styles.header}>
          <Text style={styles.headline}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to your ambit account.</Text>
        </View>

        <View style={styles.form}>
          <View>
            <Text style={styles.label}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@college.edu"
              placeholderTextColor={Brand.inkPlaceholder}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
          </View>

          <View>
            <Text style={styles.label}>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={Brand.inkPlaceholder}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
          </View>

          <Text style={styles.forgot}>Forgot password?</Text>
        </View>

        <View style={[styles.cta, { bottom: insets.bottom + ANCHORED_CTA_BOTTOM }]}>
          <Button
            title="Sign in"
            onPress={onSignedIn}
            disabled={!isValid}
            trailingArrow
          />
        </View>
      </SafeAreaView>
    </KeyboardDismiss>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Brand.canvas,
    paddingHorizontal: Space.lg,
  },
  header: { marginTop: 30 },
  headline: {
    fontFamily: AmbitFont.display,
    fontSize: 36,
    color: Brand.inkPrimary,
    lineHeight: 44,
  },
  subtitle: {
    fontFamily: AmbitFont.body,
    fontSize: 14,
    color: Brand.inkMuted,
    marginTop: 12,
  },
  form: {
    marginTop: 40,
    gap: 20,
  },
  label: {
    fontFamily: AmbitFont.body,
    fontSize: 16,
    color: Brand.inkPrimary,
    marginBottom: 10,
  },
  input: {
    height: 48,
    borderRadius: Radii.md,
    paddingHorizontal: 16,
    backgroundColor: Brand.surface1,
    fontFamily: AmbitFont.body,
    fontSize: 16,
    color: Brand.inkBody,
    fontWeight: '600',
  },
  forgot: {
    fontFamily: AmbitFont.body,
    fontSize: 13,
    color: Brand.accent,
    textAlign: 'right',
    marginTop: -4,
  },
  cta: {
    position: 'absolute',
    left: Space.lg,
    right: Space.lg,
    // bottom set dynamically to match the linear flow's anchored CTA.
  },
});
