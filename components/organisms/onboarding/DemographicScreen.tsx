import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackChevron, OptionCard } from '../../atoms';
import { OnboardingContinue } from '../../molecules';
import { useOnboarding, Demographic } from '../../../context/OnboardingContext';
import { Brand, AmbitFont, Space } from '../../../constants/theme';

interface Props { onBack: () => void; onContinue: () => void; }

/// Demographic gate. Two roles share the platform:
///  - Students (primary audience — build projects, find collaborators)
///  - Professors (post research opportunities, recruit students)
///
/// This is captured early because the rest of the onboarding may tailor
/// downstream copy + ranking (e.g. professors don't have a 'campus' the
/// same way; their identity is research-group anchored).
export function DemographicScreen({ onBack, onContinue }: Props) {
  const { profile, update } = useOnboarding();

  const pick = (d: Demographic) => update('demographic', d);
  const isValid = profile.demographic !== null;

  return (
    <SafeAreaView style={styles.root}>
      <BackChevron onPress={onBack} />

      <View style={styles.content}>
        <Text style={styles.headline}>Are you the student{'\n'}or the professor?</Text>
        <Text style={styles.subtitle}>
          Students build, professors recruit. Both are welcome.
        </Text>

        <View style={styles.cards}>
          <OptionCard
            title="Student"
            subtitle={`Undergrad or grad — looking to build,\njoin, or collaborate.`}
            selected={profile.demographic === 'student'}
            onPress={() => pick('student')}
          />
          <OptionCard
            title="Professor"
            subtitle={`Faculty or researcher — recruiting\nstudents to your project.`}
            selected={profile.demographic === 'professor'}
            onPress={() => pick('professor')}
          />
        </View>
      </View>

      <OnboardingContinue onPress={onContinue} disabled={!isValid} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.canvas },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 60,
  },
  headline: {
    fontFamily: AmbitFont.display,
    fontSize: 30,
    color: Brand.inkPrimary,
    paddingHorizontal: Space.lg,
  },
  subtitle: {
    fontFamily: AmbitFont.body,
    fontSize: 13,
    color: Brand.inkMuted,
    marginTop: 12,
    paddingHorizontal: Space.lg,
  },
  cards: {
    marginTop: 32,
    paddingHorizontal: 16,
    gap: 16,
  },
});
