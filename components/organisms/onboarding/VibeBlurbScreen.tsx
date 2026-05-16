import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Brand, AmbitFont } from '../../../constants/theme';
import { BackChevron, OnboardingContinue } from '../../molecules/OnboardingContinue';

interface Props {
  blurb: string;
  setBlurb: (v: string) => void;
  onBack: () => void;
  onContinue: () => void;
}

const MAX_LEN = 280;

/// S-007 Vibe Blurb Composer. Figma node 18:365. Fraunces/Zodiak headline,
/// 280-char counter, tan helper coaching copy.
export function VibeBlurbScreen({ blurb, setBlurb, onBack, onContinue }: Props) {
  const isValid = blurb.length >= 50 && blurb.length <= MAX_LEN;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <BackChevron onPress={onBack} />

      <View style={styles.spacer} />

      <Text style={styles.headline}>What’s your vibe?</Text>
      <Text style={styles.subtitle}>This will be shown on your profile.</Text>

      <TextInput
        value={blurb}
        onChangeText={(v) => setBlurb(v.slice(0, MAX_LEN))}
        placeholder="I’m a pretty easygoing guy, but I’m honest about my feelings towards a product/feature. I’m passionate about the projects I join :D"
        placeholderTextColor={Brand.inkPlaceholder}
        multiline
        textAlignVertical="top"
        style={styles.textArea}
      />

      <View style={styles.helperRow}>
        <Text style={styles.helper}>
          Be honest. The best teams know and like each other for who they actually are.
        </Text>
        <Text style={[styles.count, { color: blurb.length === 0 ? Brand.inkDisabled : Brand.inkMuted }]}>
          {blurb.length} / {MAX_LEN}
        </Text>
      </View>

      <View style={{ flex: 1 }} />

      <OnboardingContinue title="Continue" onPress={onContinue} disabled={!isValid} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 25, paddingBottom: 60, backgroundColor: Brand.canvas },
  spacer: { height: 50 },
  headline: { fontFamily: AmbitFont.display, fontSize: 30, color: Brand.inkPrimary },
  subtitle: {
    fontFamily: AmbitFont.body, fontSize: 14, color: Brand.inkMuted, marginTop: 8,
  },
  textArea: {
    height: 114, borderRadius: 16, padding: 14, marginTop: 16,
    backgroundColor: Brand.surface1,
    borderWidth: 1.5, borderColor: Brand.borderDefault,
    fontFamily: AmbitFont.body, fontSize: 15, color: Brand.inkBody,
  },
  helperRow: { flexDirection: 'row', marginTop: 12, gap: 12 },
  helper: { flex: 1, fontFamily: AmbitFont.body, fontSize: 13, color: Brand.accent },
  count: { fontFamily: AmbitFont.body, fontSize: 12 },
});
