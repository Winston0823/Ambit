import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { Astra, AmbitFont } from '../../../constants/theme';

/// S-001 Splash — the liftoff.
///
/// The Ambit mark, split into three solid-color layers (the serif A, the
/// exhaust, the rocket), animated minimally: the rocket launches straight up
/// out of the A and off the top of frame while the exhaust blows out beneath
/// it; the A stays put as the brand anchor. The `ambit` wordmark then resolves
/// beneath it and `onContinue` hands off to OnboardingFlow, which fades the
/// welcome screen in over ~1100ms — the pair reads as one deliberate entry.
///
/// No video, no particles: flat layers + native-driver transforms. Reduced
/// motion collapses to the static mark + wordmark. The `onContinue` contract
/// (fires exactly once) is unchanged from the old wordmark-only splash.

const LAYER_A = require('../../../assets/splash/mark-a.png');
const LAYER_EXHAUST = require('../../../assets/splash/mark-exhaust.png');
const LAYER_ROCKET = require('../../../assets/splash/mark-rocket.png');

const MARK_ASPECT = 673 / 729; // height / width of the exported layers

// One tunable timing block (ms from mount).
const T = {
  introMs: 380, // mark fades + settles in
  launchDelay: 620, // beat before ignition
  launchMs: 900, // rocket climb out of frame
  rocketFadeMs: 320, // rocket dissolves as it clears the A
  exhaustMs: 720, // exhaust blows out
  wordmarkAt: 1500, // wordmark begins
  wordmarkMs: 600,
  handoffAt: 2450, // onContinue fires
  reducedHold: 1600, // static fallback hold
};

interface Props {
  onContinue: () => void;
}

export function SplashScreen({ onContinue }: Props) {
  // Resolve the a11y pref before committing to a branch so we never start the
  // animation and then yank it. `null` = still resolving → hold the void
  // ground (matches the native boot splash, so there's no flash).
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => alive && setReduceMotion(v))
      .catch(() => alive && setReduceMotion(false));
    return () => {
      alive = false;
    };
  }, []);

  if (reduceMotion === null) return <View style={styles.root} />;
  return <Liftoff onContinue={onContinue} reduced={reduceMotion} />;
}

function Liftoff({ onContinue, reduced }: Props & { reduced: boolean }) {
  const { width, height } = useWindowDimensions();

  const markW = Math.min(width * 0.62, 300);
  const markH = markW * MARK_ASPECT;
  const markLeft = (width - markW) / 2;
  const markTop = height * 0.3;
  const launchDist = markTop + markH; // clear the top of the screen

  // Animated drivers (all native-driver friendly).
  const intro = useRef(new Animated.Value(0)).current; // 0→1 mark reveal
  const rocketY = useRef(new Animated.Value(0)).current; // 0→1 climb
  const rocketOp = useRef(new Animated.Value(1)).current; // 1→0 fade on exit
  const exhaust = useRef(new Animated.Value(0)).current; // 0→1 blow out
  const wordmark = useRef(new Animated.Value(0)).current; // 0→1 reveal
  const done = useRef(false);

  useEffect(() => {
    const fire = () => {
      if (done.current) return;
      done.current = true;
      onContinue();
    };

    // Mark always reveals.
    Animated.timing(intro, {
      toValue: 1,
      duration: T.introMs,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    let handoff: ReturnType<typeof setTimeout>;

    if (reduced) {
      // Static: mark + wordmark, no launch.
      Animated.timing(wordmark, {
        toValue: 1,
        duration: 500,
        delay: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      handoff = setTimeout(fire, T.reducedHold);
      return () => clearTimeout(handoff);
    }

    Animated.parallel([
      // Exhaust blows out (slight overshoot, then settles via the interpolation).
      Animated.timing(exhaust, {
        toValue: 1,
        duration: T.exhaustMs,
        delay: T.launchDelay - 120,
        easing: Easing.out(Easing.back(1.6)),
        useNativeDriver: true,
      }),
      // Rocket climbs out (accelerating).
      Animated.timing(rocketY, {
        toValue: 1,
        duration: T.launchMs,
        delay: T.launchDelay,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      // Rocket dissolves as it clears the A.
      Animated.timing(rocketOp, {
        toValue: 0,
        duration: T.rocketFadeMs,
        delay: T.launchDelay + T.launchMs * 0.55,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      // Wordmark resolves beneath the A.
      Animated.timing(wordmark, {
        toValue: 1,
        duration: T.wordmarkMs,
        delay: T.wordmarkAt,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    handoff = setTimeout(fire, T.handoffAt);
    return () => clearTimeout(handoff);
  }, [reduced, intro, rocketY, rocketOp, exhaust, wordmark, onContinue, launchDist]);

  const markStyle = {
    opacity: intro,
    transform: [
      { scale: intro.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
    ],
  };
  const layerBox = {
    position: 'absolute' as const,
    left: markLeft,
    top: markTop,
    width: markW,
    height: markH,
  };

  return (
    <View style={styles.root}>
      {/* A — brand anchor, stays put */}
      <Animated.Image
        source={LAYER_A}
        resizeMode="contain"
        style={[layerBox, markStyle]}
      />
      {/* Exhaust — blows out beneath the rocket */}
      <Animated.Image
        source={LAYER_EXHAUST}
        resizeMode="contain"
        style={[
          layerBox,
          {
            opacity: reduced
              ? intro
              : exhaust.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] }),
            transform: [
              {
                scale: reduced
                  ? 1
                  : exhaust.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] }),
              },
              {
                translateY: reduced
                  ? 0
                  : exhaust.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }),
              },
            ],
          },
        ]}
      />
      {/* Rocket — launches up and out */}
      <Animated.Image
        source={LAYER_ROCKET}
        resizeMode="contain"
        style={[
          layerBox,
          {
            opacity: reduced ? intro : Animated.multiply(intro, rocketOp),
            transform: [
              {
                translateY: reduced
                  ? 0
                  : rocketY.interpolate({
                      inputRange: [0, 0.12, 1],
                      outputRange: [0, 6, -launchDist], // tiny dip, then climb
                    }),
              },
            ],
          },
        ]}
      />
      {/* Wordmark — resolves beneath the A */}
      <Animated.Text
        style={[
          styles.wordmark,
          {
            top: markTop + markH + 20,
            opacity: wordmark,
            transform: [
              { translateY: wordmark.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
            ],
          },
        ]}
      >
        ambit
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Astra.void,
  },
  wordmark: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontFamily: AmbitFont.display,
    fontSize: 52,
    color: Astra.canvas,
    letterSpacing: -1,
  },
});
