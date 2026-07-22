import React, { useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Eye, EyeSlash, HandWaving } from 'phosphor-react-native';
import { BackChevron, Button, KeyboardDismiss } from '../../atoms';
import { ANCHORED_CTA_BOTTOM } from '../../molecules/OnboardingContinue';
import { SocialAuthButtons } from '../../molecules';
import { useAuth } from '../../../context/AuthContext';
import { toast } from '../../../lib/toast';
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
  const { signInWithEmail, signInWithApple, signInWithGoogle, sendPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [socialBusy, setSocialBusy] = useState<'apple' | 'google' | null>(null);
  const [error, setError] = useState('');
  const passwordRef = useRef<TextInput>(null);

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

  /// Account recovery. Mirrors EduEmailScreen's validate-email-first + toast
  /// pattern: guard on a syntactically valid email, then fire the reset and
  /// confirm via toast (audit P0: this button was dead).
  const handleForgotPassword = async () => {
    if (resetting) return;
    const trimmed = email.trim();
    if (!(trimmed.includes('@') && trimmed.includes('.'))) {
      setError('Enter your email above first, then tap “Forgot password?”.');
      return;
    }
    setResetting(true);
    setError('');
    try {
      await sendPasswordReset(trimmed);
      toast.success(`Reset link sent to ${trimmed}. Check your inbox.`);
    } catch (e: any) {
      toast.error(e?.message ?? 'Couldn’t send the reset email. Try again.');
    } finally {
      setResetting(false);
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
        <HandWaving size={280} color={Brand.actionDeep} weight="duotone" />
      </View>

      <BackChevron onPress={onBack} />

      {/* KAV is the positioning parent for the anchored CTA + errorNote, so
          both ride up with the keyboard instead of hiding behind it (audit
          P1, matching OnboardingScaffold's pattern). */}
      <KeyboardAvoidingView
        style={styles.kav}
        // Android: don't lift the anchored sign-in button with the keyboard
        // (unwanted + janky under edge-to-edge). iOS keeps the smooth padding lift.
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
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
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              blurOnSubmit={false}
            />
          </View>

          <View>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWrap}>
              <TextInput
                ref={passwordRef}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={Brand.inkPlaceholder}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                style={[styles.input, styles.inputWithIcon]}
                returnKeyType="done"
                onSubmitEditing={handleSignIn}
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

          <Pressable
            hitSlop={8}
            style={styles.forgotWrap}
            onPress={handleForgotPassword}
            disabled={resetting}
            accessibilityRole="button"
            accessibilityLabel="Send a password reset email"
          >
            <Text style={styles.forgot}>
              {resetting ? 'Sending reset link…' : 'Forgot password?'}
            </Text>
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.canvas },
  kav: { flex: 1 },
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
    gap: 16,
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
    fontFamily: AmbitFont.semibold,
    fontSize: 14,
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
    fontFamily: AmbitFont.medium,
    fontSize: 16,
    color: Brand.inkBody,
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
    fontFamily: AmbitFont.semibold,
    fontSize: 13,
    color: Brand.actionDeep,
  },
  errorNote: {
    fontFamily: AmbitFont.body,
    fontSize: 13,
    color: Brand.danger,
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
