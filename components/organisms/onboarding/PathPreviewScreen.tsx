import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  Compass,
  GraduationCap,
  MapPin,
  Rocket,
  ShieldCheck,
  Sparkle,
} from 'phosphor-react-native';
import type { IconProps } from 'phosphor-react-native';
import { Entrance } from '../../atoms';
import { OnboardingContinue } from '../../molecules';
import { OnboardingScaffold } from './OnboardingScaffold';
import { Brand, AmbitFont, Space } from '../../../constants/theme';

interface Props { onBack: () => void; onContinue: () => void; }

type PhosphorIcon = React.ComponentType<IconProps>;

/// Encouraging interstitial (Duolingo-style) shown right after Welcome.
/// Previews the short gate as a vertical path so the user sees the finish
/// line up front — "just a few quick steps" is one of the strongest
/// anti-drop-off cues. Generic order (seeker max); the actual flow branches
/// later for owners/professors.
const PATH: { icon: PhosphorIcon; label: string }[] = [
  { icon: ShieldCheck,   label: 'Verify your school email' },
  { icon: GraduationCap, label: 'Tell us who you are' },
  { icon: Compass,       label: 'Pick your role' },
  { icon: MapPin,        label: 'Your campus' },
  { icon: Sparkle,       label: 'A few skills' },
];

export function PathPreviewScreen({ onBack, onContinue }: Props) {
  return (
    <OnboardingScaffold
      onBack={onBack}
      watermarkIcon={Rocket}
      kicker="Almost there"
      headline={`A few quick\nsteps.`}
      subtitle="About a minute. We save as you go."
      footer={<OnboardingContinue title="Let's go" onPress={onContinue} />}
    >
      <View style={styles.path}>
        {PATH.map(({ icon: Icon, label }, i) => (
          <Entrance key={label} index={i + 2} step={90}>
            <View style={styles.row}>
              <View style={styles.chip}>
                <Icon size={22} color={Brand.actionDeep} weight="duotone" />
              </View>
              <Text style={styles.label}>{label}</Text>
            </View>
          </Entrance>
        ))}
      </View>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  path: {
    paddingHorizontal: Space.lg,
    paddingTop: 8,
    gap: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  chip: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Brand.seekerSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: AmbitFont.semibold,
    fontSize: 16,
    color: Brand.inkHigh,
  },
});
