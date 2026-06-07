import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Mailbox } from 'phosphor-react-native';
import { KeyboardDismiss } from '../../atoms';
import { Entrance } from '../../atoms/Entrance';
import { OnboardingContinue } from '../../molecules';
import { OnboardingScaffold } from './OnboardingScaffold';
import { useOnboarding } from '../../../context/OnboardingContext';
import { useAuth } from '../../../context/AuthContext';
import { Brand, AmbitFont, Radii, Space } from '../../../constants/theme';

interface Props { onBack: () => void; onContinue: () => void; }

/// S-004 .edu Verification. Email + password sign-up / sign-in.
export function EduEmailScreen({ onBack, onContinue }: Props) {
  const { profile, update } = useOnboarding();
  const { signUpWithEmail, signInWithEmail } = useAuth();
  const [password, setPassword] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const emailValid =
    profile.eduEmail.toLowerCase().endsWith('.edu') &&
    profile.eduEmail.includes('@');
  const isValid = emailValid && password.length >= 6;

  const handleSubmit = async () => {
    if (!isValid || sending) return;
    setSending(true);
    setError('');
    try {
      try {
        await signInWithEmail(profile.eduEmail, password);
      } catch {
        await signUpWithEmail(profile.eduEmail, password);
      }
      onContinue();
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setSending(false);
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
          title={sending ? undefined : 'Continue'}
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
              editable={!sending}
            />

            <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="6+ characters"
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
    fontFamily: AmbitFont.body,
    fontSize: 14,
    fontWeight: '600',
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
    fontFamily: AmbitFont.body,
    fontSize: 16,
    color: Brand.inkBody,
    fontWeight: '600',
  },
  errorNote: {
    fontFamily: AmbitFont.body,
    fontSize: 13,
    color: Brand.danger,
    marginTop: 12,
  },
});
