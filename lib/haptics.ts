import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

/// Semantic haptic vocabulary — one place to map *meaning* → feedback, so the
/// whole app speaks the same tactile language (and web/no-op is handled once).
///   tap       — light confirmation on a button/card press
///   medium    — a weightier press (primary CTAs, pickups)
///   selection — discrete change: tab switch, chip toggle, picker tick
///   success   — an earned positive moment: sent, matched, confirmed, hired
///   warning   — a reversible/destructive prompt
///   error     — a failed action

const enabled = () => Platform.OS !== 'web';

export const haptics = {
  tap:       () => { if (enabled()) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); },
  medium:    () => { if (enabled()) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); },
  selection: () => { if (enabled()) Haptics.selectionAsync().catch(() => {}); },
  success:   () => { if (enabled()) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); },
  warning:   () => { if (enabled()) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}); },
  error:     () => { if (enabled()) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}); },
};

export type HapticKind = keyof typeof haptics;
