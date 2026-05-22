import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Eye, EyeSlash, HandWaving } from 'phosphor-react-native';
import { BackChevron, Button, KeyboardDismiss } from '../../atoms';
import { ANCHORED_CTA_BOTTOM } from '../../molecules/OnboardingContinue';
import { SocialAuthButtons } from '../../molecules';
import { useAuth } from '../../../context/AuthContext';
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
  const { signInWithEmail, signInWithApple, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [socialBusy, setSocialBusy] = useState<'apple' | 'google' | null>(null);
  const [error, setError] = useState('');

  const isValid =
    email.includes('@') && email.includes('.') && password.length >= 6;

  const handleSignIn = async () => {
    if (!isValid || loading) return;
    setLoading(true);
    setError('');
    try {
      await signInWithEmail(email, password);
      onSignedIn();
    } catch (e: any) {
      setError(e?.message ?? 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleApple = async () => {
    setSocialBusy('apple');
    setError('');
    try {
      await signInWithApple();
      onSignedIn();
    } catch (e: any) {
      Alert.alert('Apple sign-in failed', e?.message ?? 'Try again.');
    } finally {
      setSocialBusy(null);
    }
  };

  const handleGoogle = async () => {
    setSocialBusy('google');
    setError('');
    try {
      await signInWithGoogle();
      onSignedIn();
    } catch (e: any) {
      Alert.alert('Google sign-in failed', e?.message ?? 'Try again.');
    } finally {
      setSocialBusy(null);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      {/* Ambient HandWaving watermark — the "welcome back" greeting baked
          into the page. Sits in the empty space below the form (not behind
          the inputs) so it reads as atmosphere, not competition. Mirrors
          the EduEmail Mailbox so the auth/entry screens share a quiet
          visual system. */}
      <View style={styles.watermark} pointerEvents="none">
        <HandWaving size={280} color={Brand.accent} weight="duotone" />
      </View>

      <BackChevron onPress={onBack} />

      <KeyboardDismiss>
        <View style={styles.header}>
          <Text style={styles.headline}>Welcome back</Text>
          <Text style={styles.subtitle}>Pick up where you left off.</Text>
        </View>

        <View style={styles.socialWrap}>
          <SocialAuthButtons
            onAppleSignIn={handleApple}
            onGoogleSignIn={handleGoogle}
            busy={socialBusy}
          />
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or email</Text>
            <View style={styles.dividerLine} />
          </View>
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
            <View style={styles.inputWrap}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={Brand.inkPlaceholder}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                style={[styles.input, styles.inputWithIcon]}
              />
              <Pressable
                onPress={() => setShowPassword((s) => !s)}
                style={styles.eyeButton}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeSlash size={20} color={Brand.inkLabel} weight="regular" />
                ) : (
                  <Eye size={20} color={Brand.inkLabel} weight="regular" />
                )}
              </Pressable>
            </View>
          </View>

          <Pressable hitSlop={8} style={styles.forgotWrap}>
            <Text style={styles.forgot}>Forgot password?</Text>
          </Pressable>
        </View>
      </KeyboardDismiss>

      {error !== '' && <Text style={styles.errorNote}>{error}</Text>}

      <View style={[styles.cta, { bottom: insets.bottom + ANCHORED_CTA_BOTTOM }]}>
        <Button
          title="Sign in"
          onPress={handleSignIn}
          disabled={!isValid || loading}
          trailingArrow
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.canvas },
  watermark: {
    position: 'absolute',
    top: 380,
    right: -90,
    opacity: 0.07,
  },
  header: {
    paddingHorizontal: Space.lg,
    marginTop: 40,
    marginBottom: Space.lg,
  },
  socialWrap: {
    paddingHorizontal: Space.lg,
    gap: 14,
    marginBottom: Space.lg,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
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
  headline: {
    fontFamily: AmbitFont.display,
    fontSize: 30,
    color: Brand.inkPrimary,
    lineHeight: 36,
  },
  subtitle: {
    fontFamily: AmbitFont.body,
    fontSize: 13,
    color: Brand.inkMuted,
    marginTop: 12,
  },
  form: {
    paddingHorizontal: Space.lg,
    gap: 20,
  },
  label: {
    fontFamily: AmbitFont.body,
    fontSize: 14,
    fontWeight: '600',
    color: Brand.inkLabel,
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  inputWrap: {
    position: 'relative',
    justifyContent: 'center',
  },
  input: {
    height: 52,
    borderRadius: Radii.md,
    paddingHorizontal: 16,
    backgroundColor: Brand.surface1,
    borderWidth: 1.5,
    borderColor: Brand.borderDefault,
    fontFamily: AmbitFont.body,
    fontSize: 16,
    color: Brand.inkBody,
    fontWeight: '600',
  },
  inputWithIcon: {
    paddingRight: 48,
  },
  eyeButton: {
    position: 'absolute',
    right: 14,
    top: 0,
    bottom: 0,
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  forgotWrap: {
    alignSelf: 'flex-end',
    marginTop: -4,
  },
  forgot: {
    fontFamily: AmbitFont.body,
    fontSize: 13,
    color: Brand.accent,
    fontWeight: '600',
  },
  errorNote: {
    fontFamily: AmbitFont.body,
    fontSize: 13,
    color: '#C0392B',
    paddingHorizontal: Space.lg,
    marginTop: 8,
  },
  cta: {
    position: 'absolute',
    left: Space.lg,
    right: Space.lg,
    // bottom set dynamically to match the linear flow's anchored CTA.
  },
});
