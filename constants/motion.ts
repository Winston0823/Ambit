import { Easing } from 'react-native';

/// One motion language for the whole app — the "Duolingo-smooth" feel comes
/// from every interaction sharing the SAME spring + easing rather than each
/// component hand-tuning its own. Use these tokens everywhere:
///   - `Animated.spring(v, { ...Motion.press.in, useNativeDriver: true })`
///   - `Animated.timing(v, { ...Motion.timing, useNativeDriver: true })`

/// Signature easing — cinematic deceleration (cubic-bezier(0.16, 1, 0.3, 1)).
export const easeOutExpo = Easing.bezier(0.16, 1, 0.3, 1);

export const Motion = {
  easeOutExpo,

  /// Tactile press feedback: compress on press-in, spring back on release.
  press: {
    scale: 0.96,
    in:  { friction: 8, tension: 240 } as const, // snappy compress
    out: { friction: 5, tension: 200 } as const, // springy return
  },

  /// Entrance / settle springs (soft overshoot = "alive").
  spring:       { friction: 7, tension: 70 } as const,
  springGentle: { friction: 9, tension: 90 } as const,

  /// Timing-based reveals + cross-fades.
  timing:      { duration: 420, easing: easeOutExpo } as const,
  timingQuick: { duration: 240, easing: easeOutExpo } as const,

  /// Per-item delay for staggered "assemble" cascades.
  stagger: 70,
} as const;
