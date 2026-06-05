import { Easing } from 'react-native';

/// One motion language for the whole app. The canonical feel is the
/// ONBOARDING flow — its soft press and gentle iOS-native slide are the
/// nicest motion in the product, so the shared tokens lean toward it and
/// every other surface inherits that feel. Use these everywhere:
///   - `Animated.spring(v, { ...Motion.press.out, useNativeDriver: true })`
///   - `Animated.timing(v, { ...Motion.timing, useNativeDriver: true })`

/// Reveal easing — cinematic deceleration (cubic-bezier(0.16, 1, 0.3, 1)).
/// Used by Entrance + cross-fades.
export const easeOutExpo = Easing.bezier(0.16, 1, 0.3, 1);

/// Transition easing — the onboarding step slide's gentle, iOS-native
/// deceleration. Leans the whole app toward that hand-off feel.
export const easeOutCubic = Easing.out(Easing.cubic);

export const Motion = {
  easeOutExpo,
  easeOutCubic,

  /// Tactile press — a subtle compress + springy return, matching the
  /// onboarding OptionCard (the press everyone liked).
  press: {
    scale: 0.97,                                  // subtle compress (was 0.96)
    in:  { friction: 7, tension: 240 } as const,  // quick, soft compress
    out: { friction: 4, tension: 200 } as const,  // springy return (OptionCard)
  },

  /// Entrance / settle springs (soft overshoot = "alive").
  spring:       { friction: 7, tension: 70 } as const,
  springGentle: { friction: 9, tension: 90 } as const,

  /// Timing-based reveals + cross-fades (Entrance uses `timing`).
  timing:      { duration: 420, easing: easeOutExpo } as const,
  timingQuick: { duration: 240, easing: easeOutExpo } as const,

  /// Screen / step transition — the onboarding horizontal slide.
  slide:       { duration: 280, easing: easeOutCubic } as const,

  /// Per-item delay for staggered "assemble" cascades.
  stagger: 70,
} as const;
