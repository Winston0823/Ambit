import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ArrowsLeftRight, Megaphone, MagnifyingGlass } from 'phosphor-react-native';
import { OptionCard } from '../../atoms';
import { Entrance } from '../../atoms/Entrance';
import { OnboardingContinue } from '../../molecules';
import { OnboardingScaffold } from './OnboardingScaffold';
import { useOnboarding, Role } from '../../../context/OnboardingContext';
import { Compass } from 'phosphor-react-native';

interface Props { onBack: () => void; onContinue: () => void; }

/// S-009 Role Declaration. Three cards: Owner / Seeker / Both.
export function RoleDeclarationScreen({ onBack, onContinue }: Props) {
  const { profile, update } = useOnboarding();

  const pick = (r: Role) => update('role', r);

  return (
    <OnboardingScaffold
      onBack={onBack}
      watermarkIcon={Compass}
      kicker="Your role"
      headline={`How do you want\nto show up?`}
      subtitle="You can flip this anytime in your profile."
      footer={<OnboardingContinue onPress={onContinue} disabled={profile.role === null} />}
    >
      <View style={styles.cards}>
        <Entrance index={3}>
          <OptionCard
            icon={Megaphone}
            title="Project Owner"
            subtitle={`I have an idea and I'm building\na team around it`}
            selected={profile.role === 'owner'}
            onPress={() => pick('owner')}
          />
        </Entrance>
        <Entrance index={4}>
          <OptionCard
            icon={MagnifyingGlass}
            title="Project Seeker"
            subtitle={`I want to find a project and\ncontribute my skills`}
            selected={profile.role === 'seeker'}
            onPress={() => pick('seeker')}
          />
        </Entrance>
        <Entrance index={5}>
          <OptionCard
            icon={ArrowsLeftRight}
            title="Both"
            subtitle={`I'm running a project and open\nto joining others too`}
            selected={profile.role === 'both'}
            onPress={() => pick('both')}
          />
        </Entrance>
      </View>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  cards: {
    paddingHorizontal: 16,
    gap: 16,
  },
});
