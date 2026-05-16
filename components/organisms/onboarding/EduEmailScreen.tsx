import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackChevron, KeyboardDismiss } from '../../atoms';
import { useOnboarding } from '../../../context/OnboardingContext';
import { Brand, AmbitFont, Radii, Space } from '../../../constants/theme';

interface Props { onBack: () => void; onContinue: () => void; }

/// S-004 .edu Verification. Per Figma node 18:308. Title-to-input gap ~80pt
/// to match the Figma spacing; vertical content centered.
export function EduEmailScreen({ onBack, onContinue }: Props) {
  const { profile, update } = useOnboarding();
  const isValid = profile.eduEmail.toLowerCase().endsWith('.edu') && profile.eduEmail.includes('@');

  return (
    <KeyboardDismiss>
      <SafeAreaView style={styles.root}>
        <BackChevron onPress={onBack} />

        <View style={styles.content}>
          <View style={styles.illustration} />

          <Text style={styles.headline}>Please provide{'\n'}your .edu email</Text>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Education email</Text>
            <View style={styles.inputRow}>
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
        </View>
      </SafeAreaView>
    </KeyboardDismiss>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 16, backgroundColor: Brand.canvas },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 80 },
  illustration: {
    width: 188, height: 180, borderRadius: 6,
    backgroundColor: Brand.surface2,
  },
  headline: {
    fontFamily: AmbitFont.display, fontSize: 32, color: Brand.inkPrimary,
    textAlign: 'center', marginTop: 48, paddingHorizontal: 16,
  },
  field: { marginTop: 80, paddingHorizontal: 8, alignSelf: 'stretch' },
  fieldLabel: {
    fontFamily: AmbitFont.body, fontSize: 16, color: Brand.inkPrimary,
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    height: 46, borderRadius: Radii.md,
    backgroundColor: Brand.surface1,
    borderWidth: 1.5, borderColor: Brand.borderDefault,
    paddingLeft: 9, paddingRight: 5,
  },
  input: {
    flex: 1,
    fontFamily: AmbitFont.body, fontSize: 16, color: Brand.inkBody,
    fontWeight: '600',
  },
  submit: {
    width: 63, height: 36, borderRadius: 6,
    backgroundColor: Brand.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  submitArrow: { width: 28, height: 9 },
});
