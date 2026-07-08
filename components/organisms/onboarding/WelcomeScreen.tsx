import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check } from 'phosphor-react-native';
import { Button } from '../../atoms';
import { SocialAuthButtons, LegalModal } from '../../molecules';
import { useAuth } from '../../../context/AuthContext';
import { PRIVACY_POLICY, TERMS_OF_USE, type LegalDoc } from '../../../constants/legal';
import { toast } from '../../../lib/toast';
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

  // EULA gate — account creation is blocked until the user agrees (Guideline 1.2).
  const [agreed, setAgreed] = useState(false);
  const [agreeError, setAgreeError] = useState(false);
  const [legalDoc, setLegalDoc] = useState<LegalDoc | null>(null);

  const toggleAgree = () => { setAgreed((a) => !a); setAgreeError(false); };
  // Returns true if the user has agreed; otherwise flags the checkbox (now at
  // the bottom) and toasts, since the tapped CTA is up top away from it.
  const requireAgreement = (): boolean => {
    if (agreed) return true;
    setAgreeError(true);
    toast.error('Please agree to the Terms & Privacy Policy first.');
    return false;
  };

  const handleApple = async () => {
    if (!requireAgreement()) return;
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
    if (!requireAgreement()) return;
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

  const handleCreateAccount = () => {
    if (!requireAgreement()) return;
    onCreateAccount();
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
            onPress={handleCreateAccount}
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

      {/* Agree gate — pinned to the bottom. Gates every account-creation path. */}
      <View style={[styles.agreeBar, { paddingBottom: 8 }]}>
        <Pressable
          style={styles.agreeRow}
          onPress={toggleAgree}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: agreed }}
          accessibilityLabel="I agree to the Terms of Use and Privacy Policy"
        >
          <View style={[styles.checkbox, agreed && styles.checkboxOn, agreeError && !agreed && styles.checkboxError]}>
            {agreed && <Check size={13} color={Brand.inkOnBrand} weight="bold" />}
          </View>
          <Text style={styles.agreeText}>
            I agree to the{' '}
            <Text style={styles.agreeLink} onPress={() => setLegalDoc(TERMS_OF_USE)}>Terms of Use</Text>
            {' '}and{' '}
            <Text style={styles.agreeLink} onPress={() => setLegalDoc(PRIVACY_POLICY)}>Privacy Policy</Text>.
          </Text>
        </Pressable>
        {agreeError && !agreed && (
          <Text style={styles.agreeErrorText}>Please agree to the Terms to continue.</Text>
        )}
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
  agreeBar: {
    paddingTop: 12,
  },
  agreeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 2,
    marginBottom: 4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Brand.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxOn: { backgroundColor: Brand.selected, borderColor: Brand.selected },
  checkboxError: { borderColor: Brand.danger },
  agreeText: {
    flex: 1,
    fontFamily: AmbitFont.body,
    fontSize: 13,
    lineHeight: 19,
    color: Brand.inkMuted,
  },
  agreeLink: {
    color: Brand.selected,
    fontFamily: AmbitFont.semibold,
  },
  agreeErrorText: {
    fontFamily: AmbitFont.body,
    fontSize: 12.5,
    color: Brand.danger,
    marginTop: -4,
    marginLeft: 32,
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
