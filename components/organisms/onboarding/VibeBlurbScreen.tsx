import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackChevron, KeyboardDismiss } from '../../atoms';
import { OnboardingContinue } from '../../molecules';
import { useOnboarding } from '../../../context/OnboardingContext';
import { Brand, AmbitFont, Radii, Space } from '../../../constants/theme';

interface Props { onBack: () => void; onContinue: () => void; }

const MAX_LEN = 280;
const MIN_LEN = 50;

/// S-007 Vibe Blurb Composer.
export function VibeBlurbScreen({ onBack, onContinue }: Props) {
  const { profile, update } = useOnboarding();
  const blurb = profile.vibeBlurb;
  const isValid = blurb.length >= MIN_LEN && blurb.length <= MAX_LEN;

  return (
    <SafeAreaView style={styles.root}>
      <BackChevron onPress={onBack} />

      <KeyboardDismiss>
        <View style={styles.content}>
          <Text style={styles.headline}>What's your vibe?</Text>
          <Text style={styles.subtitle}>This will be shown on your profile.</Text>

          <TextInput
            value={blurb}
            onChangeText={(v) => update('vibeBlurb', v.slice(0, MAX_LEN))}
            placeholder="I'm a pretty easygoing guy, but I'm honest about my feelings towards a product/feature. I'm passionate about the projects I join :D"
            placeholderTextColor={Brand.inkPlaceholder}
            multiline
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
        </View>
      </KeyboardDismiss>

      <OnboardingContinue onPress={onContinue} disabled={!isValid} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.canvas, paddingHorizontal: 25 },
  content: { flex: 1, justifyContent: 'center', paddingBottom: 60 },
  headline: { fontFamily: AmbitFont.display, fontSize: 30, color: Brand.inkPrimary },
  subtitle: {
    fontFamily: AmbitFont.body, fontSize: 14, color: Brand.inkMuted, marginTop: 8,
  },
  textArea: {
    height: 114, borderRadius: Radii.lg, marginTop: 24,
    paddingTop: 12,
    paddingHorizontal: 14,
    paddingBottom: 14,
    backgroundColor: Brand.surface1,
    borderWidth: 1.5, borderColor: Brand.borderDefault,
    fontFamily: AmbitFont.body, fontSize: 15, color: Brand.inkBody,
    // Anchor text/placeholder/cursor to top-left. textAlignVertical must
    // live in the style sheet (Android honors it as a style, not a prop);
    // explicit textAlign keeps iOS from drifting center on empty state.
    textAlign: 'left',
    textAlignVertical: 'top',
  },
  helperRow: { flexDirection: 'row', marginTop: 12, gap: 12 },
  helper: { flex: 1, fontFamily: AmbitFont.body, fontSize: 13, color: Brand.accent },
  count: { fontFamily: AmbitFont.body, fontSize: 12 },
});
