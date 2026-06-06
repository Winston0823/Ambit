import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Brand } from '../../constants/theme';

interface Props {
  /// 0-indexed position in the linear flow (after splash/welcome).
  current: number;
  /// Total number of in-flow steps (eduEmail through role, not counting
  /// splash/welcome/signIn/complete).
  total: number;
}

const H         = 16;    // band height (fits amplitude + dot)
const CY        = 8;     // centre line
const WL        = 22;    // wavelength
const MAX_AMP   = 2.7;   // initial waviness (75% of the first pass)
const STROKE    = 3.5;
const DOT_R     = 4.5;
const TRACK_H   = 3;

/// Builds one static wave (phase 0); the scroll comes from translating it.
function buildWave(width: number, amp: number): string {
  let d = `M 0 ${CY}`;
  for (let x = 0; x <= width; x += 3) {
    const y = CY + amp * Math.sin((x / WL) * 2 * Math.PI);
    d += ` L ${x.toFixed(1)} ${y.toFixed(2)}`;
  }
  return d;
}

/// Wavy warm-tan progress at the top of every in-flow onboarding screen.
/// The filled portion is a gently scrolling sine wave whose amplitude EASES
/// to flat as the user nears the end — alive early, a calm exhale at the
/// finish. The fill width animates per step (territory crossed, no number).
/// Hidden on Splash / Welcome / SignIn / Complete.
///
/// Built on react-native-svg + plain Animated (Expo-Go safe, no reanimated):
/// the phase scroll is a native-driver `translateX` on a wave drawn one
/// wavelength wider than the track (so the loop is seamless), clipped to the
/// JS-animated fill width.
export function OnboardingProgress({ current, total }: Props) {
  const [w, setW] = useState(0);
  const progress = Math.max(0, Math.min(1, total > 0 ? current / total : 0));
  const amp = MAX_AMP * (1 - progress);

  const clip  = useRef(new Animated.Value(0)).current; // JS — fill width + dot/track positions
  const waveX = useRef(new Animated.Value(0)).current; // native — phase scroll

  useEffect(() => {
    Animated.timing(clip, {
      toValue: progress * w,
      duration: 360,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // width/left are layout props
    }).start();
  }, [progress, w, clip]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(waveX, {
        toValue: -WL,                 // shift exactly one wavelength → seamless
        duration: 1100,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [waveX]);

  const path = useMemo(() => buildWave(w + WL * 2, amp), [w, amp]);

  return (
    <View style={styles.root} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {/* Unfilled track — picks up just past the leading dot. */}
      <Animated.View style={[styles.track, { left: Animated.add(clip, 12) }]} />

      {/* Filled wave, clipped to the animated progress width. */}
      {w > 0 && (
        <Animated.View style={[styles.clip, { width: clip }]}>
          <Animated.View style={{ transform: [{ translateX: waveX }] }}>
            <Svg width={w + WL * 2} height={H}>
              <Path d={path} fill="none" stroke={Brand.actionDeep} strokeWidth={STROKE} strokeLinecap="round" />
            </Svg>
          </Animated.View>
        </Animated.View>
      )}

      {/* Leading dot at the wave's edge. */}
      {w > 0 && <Animated.View style={[styles.dot, { left: Animated.subtract(clip, DOT_R) }]} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { height: H, marginHorizontal: 24, justifyContent: 'center' },
  clip: { position: 'absolute', left: 0, top: 0, height: H, overflow: 'hidden' },
  track: {
    position: 'absolute',
    right: 0,
    top: (H - TRACK_H) / 2,
    height: TRACK_H,
    backgroundColor: Brand.surface2,
    borderRadius: TRACK_H / 2,
  },
  dot: {
    position: 'absolute',
    top: CY - DOT_R,
    width: DOT_R * 2,
    height: DOT_R * 2,
    borderRadius: DOT_R,
    backgroundColor: Brand.actionDeep,
  },
});
