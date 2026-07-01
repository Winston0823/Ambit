import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackChevron, KeyboardDismiss, TextField } from '../../atoms';
import { OnboardingContinue } from '../../molecules';
import { useOnboarding } from '../../../context/OnboardingContext';
import { checkUrl, normalizeUrl } from '../../../lib/validation';
import { Brand, AmbitFont, Space } from '../../../constants/theme';

interface Props { onBack: () => void; onContinue: () => void; }

/// S-012 Proof Links — at least one VALID link required.
export function ProofLinksScreen({ onBack, onContinue }: Props) {
  const { profile, update } = useOnboarding();
  const insets = useSafeAreaInsets();
  const { proofLinks } = profile;

  // Semantic validation per field (audit P0: "asdf" passed as proof). A field
  // is only "filled" if it's a real URL; the CTA gates on at least one valid.
  const checks = {
    github: checkUrl(proofLinks.github, 'GitHub'),
    linkedin: checkUrl(proofLinks.linkedin, 'LinkedIn'),
    portfolio: checkUrl(proofLinks.portfolio, 'portfolio'),
    resume: checkUrl(proofLinks.resume, 'resume'),
  };
  const hasAtLeastOne = Object.values(checks).some((c) => c.valid);
  // Block only on a NON-EMPTY field that's invalid — empty fields are fine.
  const anyInvalid = (Object.keys(checks) as (keyof typeof checks)[]).some(
    (k) => proofLinks[k].trim().length > 0 && !checks[k].valid,
  );

  const set = (key: keyof typeof proofLinks) => (v: string) =>
    update('proofLinks', { ...proofLinks, [key]: v });

  const handleContinue = () => {
    // Normalize bare hosts to https:// before persisting (audit: "normalize
    // https://"). Untouched fields stay empty.
    update('proofLinks', {
      github: normalizeUrl(proofLinks.github),
      linkedin: normalizeUrl(proofLinks.linkedin),
      portfolio: normalizeUrl(proofLinks.portfolio),
      resume: normalizeUrl(proofLinks.resume),
    });
    onContinue();
  };

  return (
    <SafeAreaView style={styles.root}>
      <BackChevron onPress={onBack} />

      <KeyboardDismiss>
        <View style={styles.headerWrap}>
          <Text style={styles.headline}>Show your work</Text>
          <Text style={styles.subtitle}>
            Add at least one link. Vibe sets the tone, proof validates the skill.
          </Text>
        </View>

        <ScrollView
          style={{ marginBottom: insets.bottom + 130 }}
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
            keyboardType="url"
            error={checks.github.reason}
          />
          <TextField
            label="LinkedIn"
            value={proofLinks.linkedin}
            onChangeText={set('linkedin')}
            placeholder="linkedin.com/in/yourname"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            error={checks.linkedin.reason}
          />
          <TextField
            label="Portfolio"
            value={proofLinks.portfolio}
            onChangeText={set('portfolio')}
            placeholder="yourname.com"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            error={checks.portfolio.reason}
          />
          <TextField
            label="Resume"
            value={proofLinks.resume}
            onChangeText={set('resume')}
            placeholder="link to PDF"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            error={checks.resume.reason}
          />
        </ScrollView>
      </KeyboardDismiss>

      <OnboardingContinue onPress={handleContinue} disabled={!hasAtLeastOne || anyInvalid} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.canvas, paddingHorizontal: Space.lg },
  headerWrap: { marginTop: 40 },
  headline: { fontFamily: AmbitFont.display, fontSize: 30, color: Brand.inkPrimary },
  subtitle: {
    fontFamily: AmbitFont.body, fontSize: 13, color: Brand.inkMuted, marginTop: 12,
  },
  // ScrollView itself has marginBottom = insets.bottom + 130 to clear the
  // anchored CTA — content padding only needs top + gap here.
  scroll: { paddingTop: Space.lg, gap: 20 },
});
