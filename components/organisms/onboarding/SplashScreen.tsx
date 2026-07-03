import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Astra, AmbitFont } from '../../../constants/theme';

interface Props { onContinue: () => void; }

/// S-001 Splash.
///
/// Three-beat animation: logo fades in (400ms), holds (~900ms), then fades
/// out (600ms easeInOutCubic). onContinue fires as the fade-out lands,
/// handing off to OnboardingFlow which fades the welcome screen IN — the
/// pair reads as a single, luxurious entry transition.
export function SplashScreen({ onContinue }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.sequence([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.delay(900),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 600,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);
    anim.start(({ finished }) => {
      if (finished) onContinue();
    });
    // Stop the sequence on unmount so a resuming-user setStep doesn't race
    // with the auto-advance callback firing after the component is gone.
    return () => anim.stop();
  }, [opacity, onContinue]);

  return (
    <View style={styles.root}>
      <Animated.Text style={[styles.wordmark, { opacity }]}>ambit</Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Astra.void,
  },
  wordmark: {
    fontFamily: AmbitFont.display,
    fontSize: 64,
    color: Astra.canvas,
    letterSpacing: -1,
  },
});
