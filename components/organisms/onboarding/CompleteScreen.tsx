import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Platform, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import ConfettiCannon from 'react-native-confetti-cannon';
import { Button, HardShadow } from '../../atoms';
import { Brand, AmbitFont, Space } from '../../../constants/theme';

interface Props { onDone: () => void; }

const { width: SCREEN_W } = Dimensions.get('window');

/// S-013 Onboarding Complete.
/// The only celebration moment in the flow. Spring-scales the check,
/// fires a warm-palette confetti burst, and pulses a success haptic on
/// mount so the brain registers "you finished something."
export function CompleteScreen({ onDone }: Props) {
  const scale = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const confettiRef = useRef<ConfettiCannon>(null);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5 }),
      Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true, delay: 100 }),
    ]).start();

    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }

    // Slight delay so confetti fires *with* the check spring, not before.
    const t = setTimeout(() => confettiRef.current?.start(), 180);
    return () => clearTimeout(t);
  }, [scale, opacity]);

  return (
    <SafeAreaView style={styles.root}>
      <View style={{ flex: 1 }} />

      <Animated.View style={{ transform: [{ scale }] }}>
        <HardShadow radius={48} offset={5}>
          <View style={styles.check}>
            <Feather name="check" size={40} color={Brand.actionInk} />
          </View>
        </HardShadow>
      </Animated.View>

      <Animated.Text style={[styles.headline, { opacity }]}>You're in.</Animated.Text>
      <Animated.Text style={[styles.subtitle, { opacity }]}>
        Now go find your team.
      </Animated.Text>

      <View style={{ flex: 1 }} />

      <Animated.View style={[{ opacity }, styles.cta]}>
        <Button title="Enter Ambit" onPress={onDone} trailingArrow />
      </Animated.View>

      {/* Confetti — warm-palette colors, fires once on mount via the timeout
          above. autoStart={false} so we control timing manually. */}
      <ConfettiCannon
        ref={confettiRef}
        count={140}
        origin={{ x: SCREEN_W / 2, y: -10 }}
        autoStart={false}
        fadeOut
        fallSpeed={2800}
        explosionSpeed={420}
        colors={[
          Brand.action,
          Brand.actionDeep,
          '#DDEEE3',
          '#3E6B53',
        ]}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1, paddingHorizontal: Space.lg, backgroundColor: Brand.canvas,
    alignItems: 'center',
  },
  check: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: Brand.action,
    borderWidth: 1.6, borderColor: Brand.actionInk,
    alignItems: 'center', justifyContent: 'center',
  },
  headline: {
    fontFamily: AmbitFont.display, fontSize: 44, color: Brand.inkPrimary,
    marginTop: 32,
  },
  subtitle: {
    fontFamily: AmbitFont.body, fontSize: 15, color: Brand.inkMuted,
    textAlign: 'center', marginTop: 12, paddingHorizontal: 40,
  },
  cta: {
    alignSelf: 'stretch',
    paddingBottom: Space.ctaBottom,
  },
});
