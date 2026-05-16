import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Brand, AmbitFont } from '../../../constants/theme';
import { OnboardingContinue } from '../../molecules/OnboardingContinue';

interface Props { onDone: () => void; }

/// S-013 Onboarding Complete. Figma node 18:479 is empty placeholder —
/// layered a "You're all set" message + checkmark with spring entrance.
export function CompleteScreen({ onDone }: Props) {
  const scale = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5 }),
      Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true, delay: 100 }),
    ]).start();
  }, [scale, opacity]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={{ flex: 1 }} />

      <Animated.View style={[styles.check, { transform: [{ scale }] }]}>
        <Feather name="check" size={40} color={Brand.inkOnBrand} />
      </Animated.View>

      <Animated.Text style={[styles.headline, { opacity }]}>You’re all set</Animated.Text>
      <Animated.Text style={[styles.subtitle, { opacity }]}>
        Welcome to Ambit. Tap below to start finding your team.
      </Animated.Text>

      <View style={{ flex: 1 }} />

      <Animated.View style={[{ opacity }, styles.cta]}>
        <OnboardingContinue title="Enter Ambit" onPress={onDone} />
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24, paddingBottom: 60, backgroundColor: Brand.canvas, alignItems: 'center' },
  check: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: Brand.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  headline: {
    fontFamily: AmbitFont.display, fontSize: 36, color: Brand.inkPrimary, marginTop: 32,
  },
  subtitle: {
    fontFamily: AmbitFont.body, fontSize: 15, color: Brand.inkMuted,
    textAlign: 'center', marginTop: 12, paddingHorizontal: 40,
  },
  cta: { alignSelf: 'stretch' },
});
