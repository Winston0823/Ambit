import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../atoms';
import { SocialAuthButtons, LegalModal } from '../../molecules';
import { useAuth } from '../../../context/AuthContext';
import { PRIVACY_POLICY, TERMS_OF_USE, type LegalDoc } from '../../../constants/legal';
import { Brand, AmbitFont, Radii, Space } from '../../../constants/theme';

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

  // The ACTIVE agree checkbox lives on the credential screens (sign-in +
  // edu-email), where consent is meaningful. Social auth creates accounts
  // directly from here, so it's covered by the passive "By continuing…" line.
  const [legalDoc, setLegalDoc] = useState<LegalDoc | null>(null);

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

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <SocialAuthButtons
            onAppleSignIn={handleApple}
            onGoogleSignIn={handleGoogle}
            busy={busy}
            layout="icons"
          />
        </View>
      </View>

      {/* Passive legal coverage for the direct social paths; the ACTIVE
          checkbox lives on the sign-in and edu-email screens. */}
      <View style={{ paddingBottom: 8 }}>
        <Text style={styles.legalLine}>
          By continuing, you agree to our{' '}
          <Text style={styles.agreeLink} onPress={() => setLegalDoc(TERMS_OF_USE)}>Terms of Use</Text>
          {' '}and{' '}
          <Text style={styles.agreeLink} onPress={() => setLegalDoc(PRIVACY_POLICY)}>Privacy Policy</Text>.
        </Text>
      </View>

      <LegalModal doc={legalDoc} onClose={() => setLegalDoc(null)} />
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
    borderRadius: Radii.xl,
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
  // Bottom-anchored agree gate.
  legalLine: {
    fontFamily: AmbitFont.body,
    fontSize: 12.5,
    lineHeight: 18,
    color: Brand.inkMuted,
    textAlign: 'center',
    paddingHorizontal: Space.lg,
  },
  agreeLink: {
    color: Brand.selected,
    fontFamily: AmbitFont.semibold,
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
});
