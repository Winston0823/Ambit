import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Brand } from '../../constants/theme';

interface Props {
  /// 0-indexed position in the linear flow (after splash/welcome).
  current: number;
  /// Total number of in-flow steps (eduEmail through role, not counting
  /// splash/welcome/signIn/complete).
  total: number;
}

/// Thin warm-tan progress fill at the top of every in-flow onboarding
/// screen. Animates `width` so each step advance reads as territory
/// crossed without ever showing a number — the bar speaks for itself.
/// Hidden on Splash, Welcome, SignIn, and Complete (entry/exit moments
/// don't need orientation).
export function OnboardingProgress({ current, total }: Props) {
  const pct = useRef(new Animated.Value(0)).current;
  const target = Math.max(0, Math.min(1, current / total));

  useEffect(() => {
    Animated.timing(pct, {
      toValue: target,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      // width is not native-driver compatible; the bar is 3pt tall so the
      // JS-driven layout cost is negligible.
      useNativeDriver: false,
    }).start();
  }, [target, pct]);

  return (
    <View style={styles.track}>
      <Animated.View
        style={[
          styles.fill,
          {
            width: pct.interpolate({
              inputRange: [0, 1],
              outputRange: ['0%', '100%'],
            }),
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 3,
    backgroundColor: Brand.surface2,
    borderRadius: 1.5,
    marginHorizontal: 24,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: Brand.primary,
    borderRadius: 1.5,
  },
});
