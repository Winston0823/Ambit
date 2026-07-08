import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Mailbox } from 'phosphor-react-native';
import { KeyboardDismiss } from '../../atoms';
import { Entrance } from '../../atoms/Entrance';
import { OnboardingContinue } from '../../molecules';
import { OnboardingScaffold } from './OnboardingScaffold';
import { useOnboarding } from '../../../context/OnboardingContext';
import { useAuth } from '../../../context/AuthContext';
import { checkEduEmail } from '../../../lib/validation';
import { toast } from '../../../lib/toast';
import { Brand, AmbitFont, Radii, Space } from '../../../constants/theme';

interface Props { onBack: () => void; onContinue: () => void; }

/// S-004 .edu Verification. Email + password sign-up / sign-in.
export function EduEmailScreen({ onBack, onContinue }: Props) {
  const { profile, update } = useOnboarding();
  const { signUpWithEmail, signInWithEmail, sendPasswordReset } = useAuth();
  const [password, setPassword] = useState('');
  const [sending, setSending] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState('');
  /// Surfaces the reset affordance once we KNOW the account exists (a sign-in
  /// that failed because the email was already registered = wrong password).
  const [accountExists, setAccountExists] = useState(false);
  /// Sign-up succeeded but Supabase requires email confirmation → no session.
  /// We can't advance (there's no authed user to submit a profile for), so we
  /// hold here with a "check your inbox" state. (Audit P1: confirmation void.)
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  // Real semantic validation with inline "why" (audit theme 3). `.edu` and the
  // common international academic TLDs pass; junk shows a reason, not a silent
  // disabled button.
  const emailCheck = checkEduEmail(profile.eduEmail);
  const isValid = emailCheck.valid && password.length >= 8;

  const handleSubmit = async () => {
    if (!isValid || sending) return;
    setSending(true);
    setError('');
    setAwaitingConfirmation(false);
    try {
      // Existing account, correct password → straight through.
      await signInWithEmail(profile.eduEmail, password);
      onContinue();
    } catch {
      // Sign-in failed. Either there's no account yet, OR the password was
      // wrong on an existing account. Disambiguate via the sign-up result
      // instead of blindly showing the sign-up error (audit P0: wrong-password
      // was misclassified as a sign-up error with no recovery path).
      try {
        const hasSession = await signUpWithEmail(profile.eduEmail, password);
        // No session ⇒ email confirmation is required. Do NOT advance — the
        // downstream submit would run with no authed user and silently no-op.
        if (hasSession) {
          onContinue();
        } else {
          setAwaitingConfirmation(true);
        }
      } catch (signUpErr: any) {
        const msg = String(signUpErr?.message ?? '');
        if (/already registered|already exists|user already/i.test(msg)) {
          setAccountExists(true);
          setError(
            'That email already has an Ambit account — the password didn’t match. Try again, or reset it below.',
          );
        } else {
          setError(msg || 'Something went wrong. Please try again.');
        }
      }
    } finally {
      setSending(false);
    }
  };

  const handleForgotPassword = async () => {
    if (resetting) return;
    if (!emailCheck.valid) {
      setError(emailCheck.reason || 'Enter your school email first.');
      return;
    }
    setResetting(true);
    setError('');
    try {
      await sendPasswordReset(profile.eduEmail);
      toast.success(`Reset link sent to ${profile.eduEmail}. Check your inbox.`);
    } catch (e: any) {
      toast.error(e?.message ?? 'Couldn’t send the reset email. Try again.');
    } finally {
      setResetting(false);
    }
  };

  return (
    <OnboardingScaffold
      onBack={onBack}
      watermarkIcon={Mailbox}
      kicker="Verify"
      headline={`What's your\nschool email?`}
      subtitle="We use your .edu to keep Ambit students-only."
      footer={
        <OnboardingContinue
          onPress={handleSubmit}
          disabled={!isValid || sending}
          // OnboardingContinue/Button have no loading prop — swap the label so
          // the busy state is actually visible (audit P2). Dimming is handled
          // by the disabled state above.
          title={sending ? 'One sec…' : 'Continue'}
        />
      }
    >
      <KeyboardDismiss>
        <Entrance index={2}>
          <View style={styles.formFields}>
            <Text style={styles.fieldLabel}>Education email</Text>
            <TextInput
              value={profile.eduEmail}
              onChangeText={(v) => update('eduEmail', v)}
              placeholder="example@college.edu"
              placeholderTextColor={Brand.inkPlaceholder}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              blurOnSubmit={false}
              editable={!sending}
            />
            {emailCheck.reason !== '' && (
              <Text style={styles.helperNote}>{emailCheck.reason}</Text>
            )}

            <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Password</Text>
            <TextInput
              ref={passwordRef}
              value={password}
              onChangeText={setPassword}
              placeholder="8+ characters"
              placeholderTextColor={Brand.inkPlaceholder}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
              editable={!sending}
            />

            {error !== '' && <Text style={styles.errorNote}>{error}</Text>}

            {awaitingConfirmation && (
              <Text style={styles.confirmNote}>
                Check your inbox to verify your email, then come back and tap
                Continue to finish setting up.
              </Text>
            )}

            {/* Recovery path. Always available (existing users may land here
                to sign in); emphasized once we know the account exists. */}
            <Pressable
              onPress={handleForgotPassword}
              disabled={resetting}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Send a password reset email"
              style={styles.forgotWrap}
            >
              <Text style={[styles.forgot, accountExists && styles.forgotEmphasized]}>
                {resetting ? 'Sending reset link…' : 'Forgot password?'}
              </Text>
            </Pressable>
          </View>
        </Entrance>
      </KeyboardDismiss>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  formFields: {
    paddingHorizontal: Space.lg,
  },
  fieldLabel: {
    fontFamily: AmbitFont.semibold,
    fontSize: 14,
    color: Brand.inkLabel,
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  input: {
    height: 52,
    borderRadius: Radii.md,
    paddingHorizontal: 16,
    backgroundColor: Brand.surface1,
    borderWidth: 0,
    fontFamily: AmbitFont.medium,
    fontSize: 16,
    color: Brand.inkBody,
  },
  helperNote: {
    fontFamily: AmbitFont.body,
    fontSize: 12,
    color: Brand.inkMuted,
    marginTop: 8,
  },
  errorNote: {
    fontFamily: AmbitFont.body,
    fontSize: 13,
    color: Brand.danger,
    marginTop: 12,
  },
  confirmNote: {
    fontFamily: AmbitFont.body,
    fontSize: 13,
    color: Brand.actionDeep,
    marginTop: 12,
    lineHeight: 18,
  },
  forgotWrap: {
    marginTop: 16,
    alignSelf: 'flex-start',
  },
  forgot: {
    fontFamily: AmbitFont.semibold,
    fontSize: 13,
    color: Brand.actionDeep,
  },
  forgotEmphasized: {
    fontFamily: AmbitFont.bold,
    textDecorationLine: 'underline',
  },
});
