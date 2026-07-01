/// Dirty-guard — prevents the audit's theme-9 data loss: "project-new &
/// project-edit discard edits with no dirty-guard; sign-in/edu typed input
/// lost on back."
///
/// Usage:
///   const dirty = title !== initial.title || blurb !== initial.blurb;
///   const guardBack = useDirtyGuard(dirty);
///   <BackChevron onPress={() => guardBack(() => router.back())} />
///
/// When the form is dirty, `guardBack(leave)` shows a confirm dialog and only
/// calls `leave` if the user chooses to discard. When clean, it leaves
/// immediately. Keeps the discard copy consistent app-wide.

import { useCallback } from 'react';
import { Alert } from 'react-native';

export interface DirtyGuardCopy {
  title?: string;
  message?: string;
  discardLabel?: string;
  keepLabel?: string;
}

export function useDirtyGuard(isDirty: boolean, copy: DirtyGuardCopy = {}) {
  return useCallback(
    (leave: () => void) => {
      if (!isDirty) {
        leave();
        return;
      }
      Alert.alert(
        copy.title ?? 'Discard changes?',
        copy.message ?? "You've made edits that haven't been saved.",
        [
          { text: copy.keepLabel ?? 'Keep editing', style: 'cancel' },
          { text: copy.discardLabel ?? 'Discard', style: 'destructive', onPress: leave },
        ],
      );
    },
    [isDirty, copy.title, copy.message, copy.discardLabel, copy.keepLabel],
  );
}
