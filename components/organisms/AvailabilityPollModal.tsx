import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { X } from 'phosphor-react-native';
import {
  buildGrid,
  busyCellKeys,
  listAvailabilityResponses,
  selectedCellKeys,
  setAvailabilityResponse,
  type AvailabilityPollRow,
  type AvailabilityResponseRow,
} from '../../lib/availability';
import { getBusyEvents } from '../../lib/deviceCalendar';
import { AvailabilityGrid } from '../molecules/AvailabilityGrid';
import { supabase } from '../../lib/supabase';
import { AmbitFont, Brand, Space } from '../../constants/theme';

interface Props {
  visible: boolean;
  poll:    AvailabilityPollRow | null;
  meId:    string;
  onClose: () => void;
}

const SAVE_DEBOUNCE_MS = 500;

/// Fullscreen modal for viewing / responding to / finalizing an
/// availability poll. Loads both participants' responses, subscribes to
/// realtime updates, debounces my own response saves, and exposes a
/// "Lock in" action per overlap slot.
export function AvailabilityPollModal({ visible, poll, meId, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [responses, setResponses] = useState<AvailabilityResponseRow[]>([]);
  const [busyKeys, setBusyKeys]   = useState<Set<string>>(new Set());
  const [loading, setLoading]     = useState(true);
  /// Mirror of my response while the user is editing — debounced into
  /// availability_responses. Realtime UPDATEs on my own row are ignored
  /// (caller is the source of truth for local state).
  const [mineKeys, setMineKeys]   = useState<Set<string>>(new Set());
  const [saving, setSaving]       = useState(false);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef   = useRef<RealtimeChannel | null>(null);

  // ── Initial load ─────────────────────────────────────────────
  useEffect(() => {
    if (!visible || !poll) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const [resps, busyEvents] = await Promise.all([
          listAvailabilityResponses(poll.id),
          getBusyEvents(parseISODate(poll.start_date), endOfDay(parseISODate(poll.end_date))),
        ]);
        if (cancelled) return;
        setResponses(resps);
        const cells = buildGrid(poll);
        setBusyKeys(busyCellKeys(cells, busyEvents));
        const mine = resps.find((r) => r.user_id === meId);
        setMineKeys(mine ? selectedCellKeys(mine.selected_slots) : new Set());
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visible, poll?.id, meId]);

  // ── Realtime: partner's updates ──────────────────────────────
  useEffect(() => {
    if (!visible || !poll) return;
    const ch = supabase
      .channel(`poll:${poll.id}`)
      .on(
        'postgres_changes',
        {
          event:  '*',
          schema: 'public',
          table:  'availability_responses',
          filter: `poll_id=eq.${poll.id}`,
        },
        (payload) => {
          const row = (payload.new ?? payload.old) as AvailabilityResponseRow;
          if (row.user_id === meId) return;  // ignore self-echo
          setResponses((prev) => {
            const without = prev.filter((r) => r.user_id !== row.user_id);
            return payload.eventType === 'DELETE' ? without : [...without, row];
          });
        },
      )
      .on(
        'postgres_changes',
        {
          event:  'UPDATE',
          schema: 'public',
          table:  'availability_polls',
          filter: `id=eq.${poll.id}`,
        },
        (payload) => {
          // Closing the poll dismisses the modal — the new
          // scheduling_request will surface in the thread.
          const row = payload.new as AvailabilityPollRow;
          if (row.status !== 'open') onClose();
        },
      )
      .subscribe();
    channelRef.current = ch;
    return () => {
      ch.unsubscribe();
      channelRef.current = null;
    };
  }, [visible, poll?.id, meId, onClose]);

  // ── Debounced save of my response ───────────────────────────
  useEffect(() => {
    if (!visible || !poll) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const slots = Array.from(mineKeys).map((key) => {
        const start = new Date(key);
        const end   = new Date(start.getTime() + poll.duration_min * 60_000);
        return { start: start.toISOString(), end: end.toISOString() };
      });
      setAvailabilityResponse(poll.id, slots).catch((e) =>
        console.warn('set_availability_response failed:', e?.message),
      );
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [mineKeys, visible, poll?.id]);

  const cells = useMemo(() => (poll ? buildGrid(poll) : []), [poll]);

  const theirKeys = useMemo(() => {
    if (!poll) return new Set<string>();
    const theirs = responses.find((r) => r.user_id !== meId);
    return theirs ? selectedCellKeys(theirs.selected_slots) : new Set<string>();
  }, [responses, meId, poll?.id]);

  const toggleCell = (key: string) => {
    setMineKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSave = async () => {
    if (!poll || saving) return;
    setSaving(true);
    try {
      const slots = Array.from(mineKeys).map((key) => {
        const start = new Date(key);
        const end   = new Date(start.getTime() + poll.duration_min * 60_000);
        return { start: start.toISOString(), end: end.toISOString() };
      });
      await setAvailabilityResponse(poll.id, slots);
      onClose();
    } catch (e: any) {
      Alert.alert('Could not save', e?.message ?? 'Try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!visible || !poll) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={onClose} hitSlop={10}>
            <X size={22} color={Brand.inkPrimary} weight="bold" />
          </Pressable>
          <Text style={styles.title} numberOfLines={1}>
            {poll.title}
          </Text>
          <View style={{ width: 22 }} />
        </View>

        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator color={Brand.accent} />
          </View>
        ) : (
          <>
            <View style={styles.hintRow}>
              <Text style={styles.hint}>
                Tap the times you're free. Gray = blocked by your calendar.
              </Text>
            </View>

            <View style={{ flex: 1, paddingHorizontal: Space.md }}>
              <AvailabilityGrid
                cells={cells}
                mySelected={mineKeys}
                theirSelected={theirKeys}
                busy={busyKeys}
                editable={poll.status === 'open'}
                onToggle={toggleCell}
              />
            </View>

            {poll.status === 'open' && (
              <View style={styles.saveRow}>
                <Pressable
                  onPress={handleSave}
                  disabled={saving}
                  style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                  accessibilityRole="button"
                  accessibilityLabel="Save your available times"
                >
                  <Text style={styles.saveBtnText}>
                    {saving ? 'Saving…' : 'Save times'}
                  </Text>
                </Pressable>
              </View>
            )}
          </>
        )}
      </View>
    </Modal>
  );
}

function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function endOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(23, 59, 59, 999);
  return out;
}


const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.canvas },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Space.lg,
    paddingTop: Space.lg + 12,
    paddingBottom: Space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Brand.borderDefault,
  },
  title: {
    fontFamily: AmbitFont.display,
    fontSize: 18,
    color: Brand.inkPrimary,
    flex: 1,
    textAlign: 'center',
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintRow: {
    paddingHorizontal: Space.lg,
    paddingTop: Space.md,
    paddingBottom: Space.sm,
  },
  hint: {
    fontFamily: AmbitFont.body,
    fontSize: 13,
    color: Brand.inkMuted,
    lineHeight: 18,
  },

  saveRow: {
    paddingHorizontal: Space.lg,
    paddingVertical: Space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Brand.borderDefault,
  },
  saveBtn: {
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: Brand.action,
    alignItems: 'center',
    borderWidth: 1.6,
    borderColor: Brand.actionInk,
    shadowColor: Brand.actionInk,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 3 },
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: {
    fontFamily: AmbitFont.body,
    fontSize: 15,
    fontWeight: '700',
    color: Brand.actionInk,
  },
});
