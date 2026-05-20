import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Mailbox } from 'phosphor-react-native';
import { BackChevron, KeyboardDismiss } from '../../atoms';
import { OnboardingContinue } from '../../molecules';
import { useOnboarding } from '../../../context/OnboardingContext';
import { useAuth } from '../../../context/AuthContext';
import { Brand, AmbitFont, Radii, Space } from '../../../constants/theme';

interface Props { onBack: () => void; onContinue: () => void; }

/// S-004 .edu Verification. Email + password sign-up / sign-in.
///
/// Layout: a large Mailbox watermark sits behind the page in the upper-right,
/// bleeding slightly off the right edge. The headline is the first solid
/// element, then email + password inputs. The CTA is the standard anchored
/// OnboardingContinue at the bottom.
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
    <SafeAreaView style={styles.root}>
      {/* Ambient watermark — Mailbox bleeds off the right edge at low
          opacity, giving the page a quiet motif without competing with
          the form. pointerEvents=none so it never intercepts taps. */}
      <View style={styles.watermark} pointerEvents="none">
        <Mailbox size={360} color={Brand.accent} weight="duotone" />
      </View>

      <BackChevron onPress={onBack} />

      <KeyboardDismiss>
        <View style={styles.header}>
          <Text style={styles.headline}>What's your{'\n'}school email?</Text>
        </View>

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
      </KeyboardDismiss>

      <OnboardingContinue
        onPress={handleSubmit}
        disabled={!isValid || sending}
        title={sending ? undefined : 'Continue'}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.canvas },
  watermark: {
    position: 'absolute',
    top: 120,
    right: -90,
    opacity: 0.09,
  },
  header: {
    paddingHorizontal: Space.lg,
    marginTop: 40,
    marginBottom: Space.lg,
  },
  headline: {
    fontFamily: AmbitFont.display,
    fontSize: 30,
    color: Brand.inkPrimary,
    lineHeight: 36,
  },
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
    color: '#C0392B',
    marginTop: 10,
  },
});
