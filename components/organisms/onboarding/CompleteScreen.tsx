import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Platform, StyleSheet, Text, View } from 'react-native';
import { Check } from 'phosphor-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import ConfettiCannon from 'react-native-confetti-cannon';
import { Button, HardShadow } from '../../atoms';
import { toast } from '../../../lib/toast';
import { haptics } from '../../../lib/haptics';
import { Brand, Astra, AmbitFont, Radii, Space } from '../../../constants/theme';

/// `onDone` submits the profile and resolves on success; it REJECTS on
/// failure so we can keep the user here, tell them why, and let them retry.
interface Props { onDone: () => Promise<void>; }

const { width: SCREEN_W } = Dimensions.get('window');

/// S-013 Onboarding Complete.
/// The only celebration moment in the flow. Spring-scales the check,
/// fires a warm-palette confetti burst, and pulses a success haptic on
/// mount so the brain registers "you finished something."
export function CompleteScreen({ onDone }: Props) {
  const scale = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const confettiRef = useRef<ConfettiCannon>(null);
  const [submitting, setSubmitting] = useState(false);

  /// Drive the final submit. Double-tap guarded via `submitting`. On success
  /// the parent dismisses/reroutes (we keep the button disabled through the
  /// unmount). On failure we re-enable the button (the on-screen Retry) and
  /// raise a toast with a Retry action + the reason.
  const handlePress = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onDone();
      // Leave `submitting` true — the flow is dismissing/rerouting now.
    } catch (e: any) {
      haptics.error();
      setSubmitting(false);
      toast.error(
        e?.message ?? "Couldn't finish setting up your profile. Try again.",
        { actionLabel: 'Retry', onAction: () => { void handlePress(); } },
      );
    }
  }, [submitting, onDone]);

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
        <HardShadow radius={Radii.lg} offset={5}>
          <View style={styles.check}>
            <Check size={40} color={Brand.inkOnBrand} weight="bold" />
          </View>
        </HardShadow>
      </Animated.View>

      <Animated.Text style={[styles.headline, { opacity }]}>You're in.</Animated.Text>
      <Animated.Text style={[styles.subtitle, { opacity }]}>
        Now go find your team.
      </Animated.Text>

      <View style={{ flex: 1 }} />

      <Animated.View style={[{ opacity }, styles.cta]}>
        <Button
          title={submitting ? 'Entering…' : 'Enter Ambit'}
          onPress={handlePress}
          disabled={submitting}
          trailingArrow
        />
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
          Brand.selected,
          Astra.iris,
          Astra.lilac,
          Astra.canvas,
        ]}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1, paddingHorizontal: Space.lg, backgroundColor: Astra.void,
    alignItems: 'center',
  },
  check: {
    width: 96, height: 96, borderRadius: Radii.lg,
    backgroundColor: Brand.selected,
    borderWidth: 1.6, borderColor: Astra.iris,
    alignItems: 'center', justifyContent: 'center',
  },
  headline: {
    fontFamily: AmbitFont.display, fontSize: 44, color: Astra.canvas,
    marginTop: 32,
  },
  subtitle: {
    fontFamily: AmbitFont.body, fontSize: 15, color: Astra.lilac,
    textAlign: 'center', marginTop: 12, paddingHorizontal: 40,
  },
  cta: {
    alignSelf: 'stretch',
    paddingBottom: Space.ctaBottom,
  },
});
