import React from 'react';
import { GestureResponderEvent, PanResponder, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Brand, AmbitFont } from '../../../constants/theme';
import { BackChevron, OnboardingContinue } from '../../molecules/OnboardingContinue';

interface Props {
  age: number;
  setAge: (v: number) => void;
  onBack: () => void;
  onContinue: () => void;
}

/// S-005 Age Gate — slot-machine 17 / 18 / 19. Figma node 18:327.
export function AgeGateScreen({ age, setAge, onBack, onContinue }: Props) {
  const isValid = age >= 18;

  // Swipe horizontally to change age
  const pan = React.useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 20,
      onPanResponderEnd: (_, g) => {
        if (g.dx < -40) setAge(age + 1);
        else if (g.dx > 40) setAge(Math.max(13, age - 1));
      },
    }),
  ).current;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <BackChevron onPress={onBack} />

      <View style={styles.spacer} />

      <Text style={styles.headline}>What is your age?</Text>
      <Text style={styles.subtitle}>We bring the brightest college students together</Text>

      <View style={styles.slotRow} {...pan.panHandlers}>
        <Text style={[styles.numSm, { opacity: 0.3 }]}>{age - 1}</Text>
        <Text style={styles.numLg}>{age}</Text>
        <Text style={[styles.numSm, { opacity: 0.3 }]}>{age + 1}</Text>
      </View>

      <View style={{ flex: 1 }} />

      <OnboardingContinue title="Continue" onPress={onContinue} disabled={!isValid} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 16, paddingBottom: 60, backgroundColor: Brand.canvas },
  spacer: { height: 220 },
  headline: {
    fontFamily: AmbitFont.display, fontSize: 36, color: Brand.inkPrimary,
  },
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
