import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Brand, AmbitFont } from '../../../constants/theme';
import { BackChevron, OnboardingContinue } from '../../molecules/OnboardingContinue';
import type { Role } from '../OnboardingFlow';

interface Props {
  role: Role | null;
  setRole: (v: Role) => void;
  onBack: () => void;
  onContinue: () => void;
}

/// S-009 Role Declaration — three cards: Owner / Seeker (themed) / Both.
/// Figma node 18:403.
export function RoleDeclarationScreen({ role, setRole, onBack, onContinue }: Props) {
  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <BackChevron onPress={onBack} />

      <View style={styles.spacer} />

      <Text style={styles.headline}>What are you looking for?</Text>
      <Text style={styles.subtitle}>This shapes your entire experience on Ambit</Text>

      <View style={styles.cards}>
        <RoleCard
          title="Project Owner"
          subtitle={`I have an idea and I’m building\na team around it`}
          variant="neutral"
          selected={role === 'owner'}
          onPress={() => setRole('owner')}
        />
        <RoleCard
          title="Project Seeker"
          subtitle={`I want to find a project and\ncontribute my skills`}
          variant="seeker"
          selected={role === 'seeker'}
          onPress={() => setRole('seeker')}
        />
        <RoleCard
          title="Both"
          subtitle={`I’m running a project and open\nto joining others too`}
          variant="neutral"
          selected={role === 'both'}
          onPress={() => setRole('both')}
        />
      </View>

      <View style={{ flex: 1 }} />

      <OnboardingContinue title="Continue" onPress={onContinue} disabled={role === null} />
    </SafeAreaView>
  );
}

interface CardProps {
  title: string;
  subtitle: string;
  variant: 'neutral' | 'seeker';
  selected: boolean;
  onPress: () => void;
}

function RoleCard({ title, subtitle, variant, selected, onPress }: CardProps) {
  const isSeeker = variant === 'seeker';
  return (
    <Pressable
      onPress={onPress}
      style={[
        cardStyles.card,
        { backgroundColor: isSeeker ? Brand.seekerSurface : Brand.surface2 },
        selected && { borderColor: Brand.accent, borderWidth: 2 },
      ]}
    >
      <Text style={[cardStyles.title, { color: isSeeker ? Brand.seekerTitleInk : Brand.inkHigh }]}>
        {title}
      </Text>
      <Text style={[cardStyles.subtitle, { color: isSeeker ? Brand.accent : Brand.inkMuted }]}>
        {subtitle}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 16, paddingBottom: 60, backgroundColor: Brand.canvas },
  spacer: { height: 28 },
  headline: { fontFamily: AmbitFont.display, fontSize: 30, color: Brand.inkPrimary, paddingHorizontal: 8 },
  subtitle: {
    fontFamily: AmbitFont.body, fontSize: 13, color: Brand.inkMuted, marginTop: 12, paddingHorizontal: 8,
  },
  cards: { marginTop: 18, gap: 22 },
});

const cardStyles = StyleSheet.create({
  card: {
    minHeight: 104, borderRadius: 16, padding: 20,
    borderWidth: 2, borderColor: 'transparent',
  },
  title: { fontFamily: AmbitFont.body, fontSize: 16, fontWeight: '600' },
  subtitle: { fontFamily: AmbitFont.body, fontSize: 13, marginTop: 4 },
});
