import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Brand, AmbitFont } from '../../../constants/theme';
import { BackChevron } from '../../molecules/OnboardingContinue';

interface Props {
  email: string;
  setEmail: (v: string) => void;
  onBack: () => void;
  onContinue: () => void;
}

/// S-003 / S-004 — .edu email entry. Figma node 18:270.
export function EduEmailScreen({ email, setEmail, onBack, onContinue }: Props) {
  const isValid = email.toLowerCase().endsWith('.edu') && email.includes('@');

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <BackChevron onPress={onBack} />

      <View style={styles.illustration} />

      <Text style={styles.headline}>Please provide your .edu email</Text>

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>Education email</Text>
        <View style={styles.inputRow}>
          <TextInput
            value={email}
            onChangeText={setEmail}
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
  field: { marginTop: 60, paddingHorizontal: 24 },
  fieldLabel: {
    fontFamily: AmbitFont.body, fontSize: 16, color: Brand.inkPrimary,
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    height: 46, borderRadius: 12,
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
