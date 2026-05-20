import React from 'react';
import { Image, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EnvelopeOpen } from 'phosphor-react-native';
import { BackChevron, KeyboardDismiss } from '../../atoms';
import { OnboardingContinue } from '../../molecules';
import { useOnboarding } from '../../../context/OnboardingContext';
import { Brand, AmbitFont, Radii, Space } from '../../../constants/theme';

interface Props { onBack: () => void; onContinue: () => void; }

/// S-004 .edu Verification.
///
/// Layout: illustration sits compactly upper-right (160×160 — small enough
/// not to dominate the chevron column), headline left-aligned beneath it,
/// then the input. The CTA is the standard anchored OnboardingContinue at
/// the bottom — matches every other onboarding screen so the page feels
/// like it belongs to the flow.
export function EduEmailScreen({ onBack, onContinue }: Props) {
  const { profile, update } = useOnboarding();
  const isValid =
    profile.eduEmail.toLowerCase().endsWith('.edu') &&
    profile.eduEmail.includes('@');

  return (
    <KeyboardDismiss>
      <SafeAreaView style={styles.root}>
        <BackChevron onPress={onBack} />

        <View style={styles.body}>
          {/* Illustration — compact, top-right. EnvelopeOpen + swirl arrow
              echoes the brand's hand-drawn signature mark. */}
          <View style={styles.illustrationRow}>
            <View style={styles.illustration}>
              <EnvelopeOpen
                size={84}
                color={Brand.accent}
                weight="duotone"
              />
              <Image
                source={require('../../../assets/icons/ArrowSwirl.png')}
                style={styles.illustrationSwirl}
                resizeMode="contain"
              />
            </View>
          </View>

          <View style={styles.form}>
            <Text style={styles.headline}>What's your{'\n'}school email?</Text>

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
              returnKeyType="done"
              onSubmitEditing={() => { if (isValid) onContinue(); }}
            />
          </View>
        </View>

        <OnboardingContinue onPress={onContinue} disabled={!isValid} />
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
  body: {
    flex: 1,
  },
  illustrationRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 40,
  },
  illustration: {
    width: 160,
    height: 160,
    borderRadius: Radii.lg,
    backgroundColor: Brand.seekerSurface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  illustrationSwirl: {
    position: 'absolute',
    bottom: 18,
    right: 16,
    width: 44,
    height: 15,
    transform: [{ rotate: '-10deg' }],
  },
  form: {
    marginTop: 36,
  },
  headline: {
    fontFamily: AmbitFont.display,
    fontSize: 34,
    color: Brand.inkPrimary,
    lineHeight: 42,
    marginBottom: 32,
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
});
