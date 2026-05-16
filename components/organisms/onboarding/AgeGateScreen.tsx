import React, { useRef } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackChevron } from '../../atoms';
import { OnboardingContinue } from '../../molecules';
import { useOnboarding } from '../../../context/OnboardingContext';
import { Brand, AmbitFont, Space } from '../../../constants/theme';

interface Props { onBack: () => void; onContinue: () => void; }

/// S-005 Age Gate — slot-machine 17 / 18 / 19. Swipe to change.
export function AgeGateScreen({ onBack, onContinue }: Props) {
  const { profile, update } = useOnboarding();
  const isValid = profile.age >= 18;

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 20,
      onPanResponderEnd: (_, g) => {
        if (g.dx < -40) update('age', profile.age + 1);
        else if (g.dx > 40) update('age', Math.max(13, profile.age - 1));
      },
    }),
  ).current;

  return (
    <SafeAreaView style={styles.root}>
      <BackChevron onPress={onBack} />

      <View style={styles.spacer} />

      <Text style={styles.headline}>What is your age?</Text>
      <Text style={styles.subtitle}>We bring the brightest college students together</Text>

      <View style={styles.slotRow} {...pan.panHandlers}>
        <Text style={[styles.numSm, { opacity: 0.3 }]}>{profile.age - 1}</Text>
        <Text style={styles.numLg}>{profile.age}</Text>
        <Text style={[styles.numSm, { opacity: 0.3 }]}>{profile.age + 1}</Text>
      </View>

      <View style={{ flex: 1 }} />

      <OnboardingContinue onPress={onContinue} disabled={!isValid} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 16, backgroundColor: Brand.canvas },
  spacer: { height: 220 },
  headline: { fontFamily: AmbitFont.display, fontSize: 36, color: Brand.inkPrimary },
  subtitle: {
    fontFamily: AmbitFont.body, fontSize: 16, color: Brand.inkMuted,
    marginTop: 16, maxWidth: 250,
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 80,
    paddingHorizontal: 8,
  },
  numLg: { fontFamily: AmbitFont.display, fontSize: 128, color: Brand.inkPrimary },
  numSm: { fontFamily: AmbitFont.display, fontSize: 96, color: Brand.inkPrimary },
});
