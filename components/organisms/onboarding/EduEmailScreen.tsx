import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackChevron } from '../../atoms';
import { useOnboarding } from '../../../context/OnboardingContext';
import { Brand, AmbitFont, Radii, Space } from '../../../constants/theme';

interface Props { onBack: () => void; onContinue: () => void; }

/// S-004 .edu Verification.
export function EduEmailScreen({ onBack, onContinue }: Props) {
  const { profile, update } = useOnboarding();
  const isValid = profile.eduEmail.toLowerCase().endsWith('.edu') && profile.eduEmail.includes('@');

  return (
    <SafeAreaView style={styles.root}>
      <BackChevron onPress={onBack} />

      <View style={styles.illustration} />

      <Text style={styles.headline}>Please provide your .edu email</Text>

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
          />
          <Pressable
            onPress={onContinue}
            disabled={!isValid}
            style={[styles.submit, { opacity: isValid ? 1 : 0.45 }]}
          >
            <Feather name="arrow-right" size={14} color={Brand.inkOnBrand} />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 16, backgroundColor: Brand.canvas },
  illustration: {
    width: 188, height: 180, borderRadius: 6,
    backgroundColor: Brand.surface2,
    alignSelf: 'center', marginTop: 80,
  },
  headline: {
    fontFamily: AmbitFont.display, fontSize: 32, color: Brand.inkPrimary,
    textAlign: 'center', marginTop: 32, paddingHorizontal: 16,
  },
  field: { marginTop: 60, paddingHorizontal: 8 },
  fieldLabel: {
    fontFamily: AmbitFont.body, fontSize: 16, color: Brand.inkPrimary,
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    height: 46, borderRadius: Radii.md,
    backgroundColor: Brand.surface1,
    borderWidth: 1.5, borderColor: Brand.borderDefault,
    paddingHorizontal: 5,
  },
  input: {
    flex: 1, paddingHorizontal: 9,
    fontFamily: AmbitFont.body, fontSize: 16, color: Brand.inkBody,
    fontWeight: '600',
  },
  submit: {
    width: 63, height: 36, borderRadius: 6,
    backgroundColor: Brand.primary,
    alignItems: 'center', justifyContent: 'center',
  },
});
