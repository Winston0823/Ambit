import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../atoms';
import { SocialAuthButtons } from '../../molecules';
import { useAuth } from '../../../context/AuthContext';
import { Brand, AmbitFont, Space } from '../../../constants/theme';

interface Props {
  onCreateAccount: () => void;
  onSignIn: () => void;
  /// Fired after Apple/Google sign-in succeeds. AuthContext flips the
  /// session, so this is just the dismiss hook (parent re-routes via
  /// hasProfile).
  onSocialSignedIn: () => void;
}

/// S-003 Welcome. Three entry paths now:
///   1. Continue with Apple / Google (one-tap, returning + new)
///   2. Create account (email + edu-verification flow)
///   3. Sign in (returning user, email + password)
export function WelcomeScreen({ onCreateAccount, onSignIn, onSocialSignedIn }: Props) {
  const { signInWithApple, signInWithGoogle } = useAuth();
  const [busy, setBusy] = useState<'apple' | 'google' | null>(null);

  const handleApple = async () => {
    setBusy('apple');
    try {
      await signInWithApple();
      onSocialSignedIn();
    } catch (e: any) {
      Alert.alert('Apple sign-in failed', e?.message ?? 'Try again.');
    } finally {
      setBusy(null);
    }
  };

  const handleGoogle = async () => {
    setBusy('google');
    try {
      await signInWithGoogle();
      onSocialSignedIn();
    } catch (e: any) {
      Alert.alert('Google sign-in failed', e?.message ?? 'Try again.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.content}>
        <View style={styles.logoSquare}>
          <Text style={styles.logoText}>ambit</Text>
        </View>

        <Text style={styles.headline}>Welcome to ambit</Text>
        <Text style={styles.helper}>
          The place where student builders find each other.
        </Text>

        <View style={styles.cta}>
          <SocialAuthButtons
            onAppleSignIn={handleApple}
            onGoogleSignIn={handleGoogle}
            busy={busy}
          />

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <Button
            title="Create account"
            onPress={onCreateAccount}
            variant="primary"
            trailingArrow
          />
          <Button
            title="Sign in"
            onPress={onSignIn}
            variant="secondary"
          />
        </View>

        <Pressable onPress={onCreateAccount}>
          <Text style={styles.fineprint}>
            New here? Set up takes about two minutes.
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Brand.canvas,
    paddingHorizontal: Space.lg,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  logoSquare: {
    width: 140,
    height: 140,
    borderRadius: 32,
    backgroundColor: Brand.seekerSurface,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 60,
  },
  logoText: {
    fontFamily: AmbitFont.display,
    fontSize: 36,
    color: Brand.seekerInk,
  },
  headline: {
    fontFamily: AmbitFont.display,
    fontSize: 32,
    color: Brand.inkPrimary,
    textAlign: 'center',
  },
  helper: {
    fontFamily: AmbitFont.body,
    fontSize: 14,
    color: Brand.inkMuted,
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: Space.lg,
    lineHeight: 20,
  },
  cta: {
    gap: 12,
    marginTop: 48,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Brand.borderDefault,
  },
  dividerText: {
    fontFamily: AmbitFont.body,
    fontSize: 12,
    color: Brand.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  fineprint: {
    fontFamily: AmbitFont.body,
    fontSize: 13,
    color: Brand.inkMuted,
    textAlign: 'center',
    marginTop: 20,
  },
});
