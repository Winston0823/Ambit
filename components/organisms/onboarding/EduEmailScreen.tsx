import React from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EnvelopeOpen } from 'phosphor-react-native';
import { BackChevron, KeyboardDismiss } from '../../atoms';
import { useOnboarding } from '../../../context/OnboardingContext';
import { Brand, AmbitFont, Radii, Space } from '../../../constants/theme';

interface Props { onBack: () => void; onContinue: () => void; }

/// S-004 .edu Verification. Per Figma node 18:308.
/// Layout: illustration upper-right → headline left-aligned → label → input →
/// submit (warm-tan with swirl arrow) on its own row, right-aligned.
export function EduEmailScreen({ onBack, onContinue }: Props) {
  const { profile, update } = useOnboarding();
  const isValid = profile.eduEmail.toLowerCase().endsWith('.edu') && profile.eduEmail.includes('@');

  return (
    <KeyboardDismiss>
      <SafeAreaView style={styles.root}>
        <BackChevron onPress={onBack} />

        {/* Illustration top-right — warm-tan card with EnvelopeOpen on top,
            swirl arrow overlay echoing the brand's signature mark. */}
        <View style={styles.illustrationRow}>
          <View style={styles.illustration}>
            <EnvelopeOpen
              size={120}
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

        {/* Headline + form */}
        <View style={styles.form}>
          <Text style={styles.headline}>What's your school email?</Text>

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

          <View style={styles.submitRow}>
            <Pressable
              onPress={onContinue}
              disabled={!isValid}
              style={[styles.submit, { opacity: isValid ? 1 : 0.45 }]}
            >
              <Image
                source={require('../../../assets/icons/ArrowSwirl.png')}
                style={styles.submitArrow}
                resizeMode="contain"
              />
            </Pressable>
          </View>
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
  illustrationRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 30,
  },
  illustration: {
    width: 220,
    height: 220,
    borderRadius: Radii.lg,
    backgroundColor: Brand.seekerSurface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  illustrationSwirl: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 64,
    height: 22,
    transform: [{ rotate: '-10deg' }],
  },
  form: {
    marginTop: 40,
  },
  headline: {
    fontFamily: AmbitFont.display,
    fontSize: 36,
    color: Brand.inkPrimary,
    lineHeight: 44,
    marginBottom: 28,
  },
  fieldLabel: {
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
    borderWidth: 0,
    fontFamily: AmbitFont.body,
    fontSize: 16,
    color: Brand.inkBody,
    fontWeight: '600',
  },
  submitRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
  },
  submit: {
    width: 72,
    height: 48,
    borderRadius: Radii.sm,
    backgroundColor: Brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitArrow: { width: 32, height: 10 },
});
