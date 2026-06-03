import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Chalkboard, GraduationCap } from 'phosphor-react-native';
import { OptionCard } from '../../atoms';
import { Entrance } from '../../atoms/Entrance';
import { OnboardingContinue } from '../../molecules';
import { OnboardingScaffold } from './OnboardingScaffold';
import { useOnboarding, Demographic } from '../../../context/OnboardingContext';
import { Space } from '../../../constants/theme';

interface Props { onBack: () => void; onContinue: () => void; }

/// Demographic gate. Two roles share the platform:
///  - Students (primary audience — build projects, find collaborators)
///  - Professors (post research opportunities, recruit students)
///
/// Captured early because it drives the branch: professors skip the role +
/// skills steps entirely (see shouldShow in OnboardingFlow).
export function DemographicScreen({ onBack, onContinue }: Props) {
  const { profile, update } = useOnboarding();

  const pick = (d: Demographic) => update('demographic', d);
  const isValid = profile.demographic !== null;

  return (
    <OnboardingScaffold
      onBack={onBack}
      watermarkIcon={GraduationCap}
      kicker="About you"
      headline={`Are you the student\nor the professor?`}
      subtitle="Students build, professors recruit. Both are welcome."
      footer={<OnboardingContinue onPress={onContinue} disabled={!isValid} />}
    >
      <View style={styles.cards}>
        <Entrance index={3}>
          <OptionCard
            icon={GraduationCap}
            title="Student"
            subtitle={`Undergrad or grad — looking to build,\njoin, or collaborate.`}
            selected={profile.demographic === 'student'}
            onPress={() => pick('student')}
          />
        </Entrance>
        <Entrance index={4}>
          <OptionCard
            icon={Chalkboard}
            title="Professor"
            subtitle={`Faculty or researcher — recruiting\nstudents to your project.`}
            selected={profile.demographic === 'professor'}
            onPress={() => pick('professor')}
          />
        </Entrance>
      </View>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  cards: {
    marginTop: 12,
    paddingHorizontal: 16,
    gap: 16,
  },
});
