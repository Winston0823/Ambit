import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Brand } from '../../constants/theme';

interface Props {
  /// 0-indexed position in the linear flow (after splash/welcome).
  current: number;
  /// Total number of in-flow steps (eduEmail through role, not counting
  /// splash/welcome/signIn/complete).
  total: number;
  /// Kept for API compatibility with the old wave version (was a left inset
  /// so the wave cleared a back chevron). Unused by the ring.
  leadInset?: number;
}

const SIZE   = 44;         // overall ring diameter
const STROKE = 3.5;        // ring thickness
const R      = (SIZE - STROKE) / 2;
const CX     = SIZE / 2;
const CY     = SIZE / 2;
const CIRC   = 2 * Math.PI * R;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/// ASTRA circular progress ring. A royal arc fills clockwise from 12 o'clock
/// as the user advances through onboarding, over a hairline track. No numeric
/// label — the arc is the whole story. Native-driver friendly: the fill is a
/// JS-animated strokeDashoffset (SVG props aren't native-driver eligible).
///
/// Keeps the original {current, total, leadInset} props so all call sites
/// keep compiling.
export function OnboardingProgress({ current, total }: Props) {
  const progress = Math.max(0, Math.min(1, total > 0 ? current / total : 0));
  const anim = useRef(new Animated.Value(progress)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: progress,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // strokeDashoffset is not native-driver eligible
    }).start();
  }, [progress, anim]);

  // Filled arc = progress * circumference; offset shrinks as progress grows.
  const dashoffset = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [CIRC, 0],
  });

  return (
    <View
      style={styles.root}
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${current} of ${total}`}
      accessibilityValue={{ min: 0, max: total, now: current }}
    >
      <Svg width={SIZE} height={SIZE}>
        {/* Track */}
        <Circle
          cx={CX}
          cy={CY}
          r={R}
          stroke={Brand.borderDefault}
          strokeWidth={STROKE}
          fill="none"
        />
        {/* Progress arc — rotated -90° so it starts at 12 o'clock, clockwise. */}
        <AnimatedCircle
          cx={CX}
          cy={CY}
          r={R}
          stroke={Brand.action}
          strokeWidth={STROKE}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={CIRC}
          strokeDashoffset={dashoffset}
          transform={`rotate(-90 ${CX} ${CY})`}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
});
