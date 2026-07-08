/// Dirty-guard — prevents the audit's theme-9 data loss: "project-new &
/// project-edit discard edits with no dirty-guard; sign-in/edu typed input
/// lost on back."
///
/// Usage:
///   const dirty = title !== initial.title || blurb !== initial.blurb;
///   const { guardBack, commit } = useDirtyGuard(dirty);
///   <BackChevron onPress={() => guardBack(() => router.back())} />
///   // after a successful save/delete: commit(() => router.back())
///
/// When the form is dirty, `guardBack(leave)` shows a confirm dialog and only
/// calls `leave` if the user chooses to discard. When clean, it leaves
/// immediately. `commit(leave)` leaves without prompting — for navigations
/// after the data has already been persisted. Keeps the copy consistent.
///
/// P0 (audit 2026-07-01): the custom BackChevron was the ONLY guarded exit —
/// iOS edge-swipe and Android hardware back removed the screen and discarded
/// everything. This hook now ALSO registers `usePreventRemove`, so ANY route
/// removal (system back, header back, edge-swipe) triggers the same confirm.
/// A one-shot `bypass` flag lets a confirmed discard dispatch the pending
/// navigation without the guard re-prompting (no double dialog, no loop).

import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { usePreventRemove } from '@react-navigation/native';
import { useNavigation } from 'expo-router';

export interface DirtyGuardCopy {
  title?: string;
  message?: string;
  discardLabel?: string;
  keepLabel?: string;
}

export function useDirtyGuard(isDirty: boolean, copy: DirtyGuardCopy = {}) {
  const navigation = useNavigation();
  // While true, the system guard stands down for exactly one navigation so a
  // discard the user already confirmed can go through without re-prompting.
  const [bypass, setBypass] = useState(false);
  const pending = useRef<(() => void) | null>(null);

  const title = copy.title ?? 'Discard changes?';
  const message = copy.message ?? "You've made edits that haven't been saved.";
  const keepLabel = copy.keepLabel ?? 'Keep editing';
  const discardLabel = copy.discardLabel ?? 'Discard';

  const prompt = useCallback(
    (onDiscard: () => void) => {
      Alert.alert(title, message, [
        { text: keepLabel, style: 'cancel' },
        { text: discardLabel, style: 'destructive', onPress: onDiscard },
      ]);
    },
    [title, message, keepLabel, discardLabel],
  );

  // System back / iOS edge-swipe / Android hardware back / header back all
  // dispatch a route removal → intercept it while dirty and run the same
  // confirm. On discard, stash the original action and drop the guard for one
  // dispatch (see the effect below).
  usePreventRemove(isDirty && !bypass, ({ data }) => {
    prompt(() => {
      pending.current = () => navigation.dispatch(data.action);
      setBypass(true);
    });
  });

  useEffect(() => {
    if (bypass && pending.current) {
      const run = pending.current;
      pending.current = null;
      run();
      setBypass(false);
    }
  }, [bypass]);

  // Custom BackChevron path. When clean, leave now; when dirty, show the
  // confirm and, on discard, bypass the system guard so the same `leave()`
  // (usually router.back()) isn't caught and re-prompted.
  const guardBack = useCallback(
    (leave: () => void) => {
      if (!isDirty) {
        leave();
        return;
      }
      prompt(() => {
        pending.current = leave;
        setBypass(true);
      });
    },
    [isDirty, prompt],
  );

  // Post-save / delete path. The data is already persisted (or the record is
  // gone), so there's nothing to discard — leave WITHOUT prompting even though
  // the form still reads dirty (the loaded snapshot isn't updated after a
  // save). Routes through the same one-shot bypass so `usePreventRemove`
  // doesn't intercept the navigation and strand the screen on "Saving…".
  const commit = useCallback((leave: () => void) => {
    pending.current = leave;
    setBypass(true);
  }, []);

  return { guardBack, commit };
}
