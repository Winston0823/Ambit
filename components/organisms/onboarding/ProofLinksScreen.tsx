import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackChevron, KeyboardDismiss, TextField } from '../../atoms';
import { OnboardingContinue } from '../../molecules';
import { useOnboarding } from '../../../context/OnboardingContext';
import { Brand, AmbitFont, Space } from '../../../constants/theme';

interface Props { onBack: () => void; onContinue: () => void; }

/// S-012 Proof Links — at least one required.
export function ProofLinksScreen({ onBack, onContinue }: Props) {
  const { profile, update } = useOnboarding();
  const { proofLinks } = profile;
  const hasAtLeastOne = Object.values(proofLinks).some((v) => v.trim().length > 0);

  const set = (key: keyof typeof proofLinks) => (v: string) =>
    update('proofLinks', { ...proofLinks, [key]: v });

  return (
    <KeyboardDismiss>
      <SafeAreaView style={styles.root}>
        <BackChevron onPress={onBack} />

        <View style={styles.headerWrap}>
          <Text style={styles.headline}>Show your work</Text>
          <Text style={styles.subtitle}>
            Add at least one link. Vibe sets the tone, proof validates the skill.
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <TextField
            label="GitHub"
            value={proofLinks.github}
            onChangeText={set('github')}
            placeholder="github.com/yourname"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextField
            label="LinkedIn"
            value={proofLinks.linkedin}
            onChangeText={set('linkedin')}
            placeholder="linkedin.com/in/yourname"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextField
            label="Portfolio"
            value={proofLinks.portfolio}
            onChangeText={set('portfolio')}
            placeholder="yourname.com"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextField
            label="Resume"
            value={proofLinks.resume}
            onChangeText={set('resume')}
            placeholder="link to PDF"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </ScrollView>

        <OnboardingContinue onPress={onContinue} disabled={!hasAtLeastOne} />
      </SafeAreaView>
    </KeyboardDismiss>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.canvas, paddingHorizontal: Space.lg },
  headerWrap: { marginTop: 16 },
  headline: { fontFamily: AmbitFont.display, fontSize: 30, color: Brand.inkPrimary },
  subtitle: {
    fontFamily: AmbitFont.body, fontSize: 13, color: Brand.inkMuted, marginTop: 12,
  },
  scroll: { paddingTop: Space.lg, paddingBottom: 24, gap: 18 },
});
