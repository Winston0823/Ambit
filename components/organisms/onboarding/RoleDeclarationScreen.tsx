import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackChevron, OptionCard } from '../../atoms';
import { OnboardingContinue } from '../../molecules';
import { useOnboarding, Role } from '../../../context/OnboardingContext';
import { Brand, AmbitFont, Space } from '../../../constants/theme';

interface Props { onBack: () => void; onContinue: () => void; }

/// S-009 Role Declaration. Three cards: Owner / Seeker (themed) / Both.
export function RoleDeclarationScreen({ onBack, onContinue }: Props) {
  const { profile, update } = useOnboarding();

  const pick = (r: Role) => update('role', r);

  return (
    <SafeAreaView style={styles.root}>
      <BackChevron onPress={onBack} />
      <View style={{ height: 16 }} />

      <Text style={styles.headline}>What are you looking for?</Text>
      <Text style={styles.subtitle}>This shapes your entire experience on Ambit</Text>

      <View style={styles.cards}>
        <OptionCard
          title="Project Owner"
          subtitle={`I have an idea and I'm building\na team around it`}
          variant="neutral"
          selected={profile.role === 'owner'}
          onPress={() => pick('owner')}
        />
        <OptionCard
          title="Project Seeker"
          subtitle={`I want to find a project and\ncontribute my skills`}
          variant="seeker"
          selected={profile.role === 'seeker'}
          onPress={() => pick('seeker')}
        />
        <OptionCard
          title="Both"
          subtitle={`I'm running a project and open\nto joining others too`}
          variant="neutral"
          selected={profile.role === 'both'}
          onPress={() => pick('both')}
        />
      </View>

      <View style={{ flex: 1 }} />

      <OnboardingContinue onPress={onContinue} disabled={profile.role === null} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.canvas },
  headline: {
    fontFamily: AmbitFont.display, fontSize: 30, color: Brand.inkPrimary,
    paddingHorizontal: Space.lg,
  },
  subtitle: {
    fontFamily: AmbitFont.body, fontSize: 13, color: Brand.inkMuted,
    marginTop: 12, paddingHorizontal: Space.lg,
  },
  cards: {
    marginTop: 18,
    paddingHorizontal: 16,
    gap: 22,
  },
});
