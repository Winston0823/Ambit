import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/// Shared "Reduce Motion" hook. Reads the OS accessibility setting once on
/// mount and subscribes to live changes, so every animated surface can guard
/// its motion consistently (Entrance, Skeleton, Celebrate, ToastHost, …).
///
/// Returns `true` when the user has asked the system to minimize motion. Plain
/// RN `AccessibilityInfo` — Expo-Go safe, no native deps.
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (mounted) setReduced(value);
      })
      .catch(() => {
        if (mounted) setReduced(false);
      });

    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
      if (mounted) setReduced(value);
    });

    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return reduced;
}
