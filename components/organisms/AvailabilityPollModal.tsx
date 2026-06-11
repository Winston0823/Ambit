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
  overlapCellKeys,
  selectedCellKeys,
  setAvailabilityResponse,
  type AvailabilityPollRow,
  type AvailabilityResponseRow,
} from '../../lib/availability';
import { getBusyEvents } from '../../lib/deviceCalendar';
import { AvailabilityGrid } from '../molecules/AvailabilityGrid';
import { HardShadow } from '../atoms';
import { supabase } from '../../lib/supabase';
import { AmbitFont, Brand, Space } from '../../constants/theme';

interface Props {
  visible: boolean;
  poll:    AvailabilityPollRow | null;
  meId:    string;
  onClose: () => void;
  /// Offered after a Save that produces overlap with the partner's marks —
  /// the caller opens the SchedulingComposer (pre-filled from this poll)
  /// so finding times flows straight into proposing one.
  onProposeTime?: () => void;
}

/// Fullscreen modal for viewing / responding to an availability poll.
/// Loads both participants' responses, subscribes to realtime updates,
/// and commits my marks on an explicit "Save times" (no auto-save — a
/// half-finished grid should never be visible to the partner, and the
/// old debounced save could race the initial load and wipe a response).
/// If the save produces overlap, it hands off into the propose step.
export function AvailabilityPollModal({ visible, poll, meId, onClose, onProposeTime }: Props) {
  const insets = useSafeAreaInsets();
  const [responses, setResponses] = useState<AvailabilityResponseRow[]>([]);
  const [busyKeys, setBusyKeys]   = useState<Set<string>>(new Set());
  const [loading, setLoading]     = useState(true);
  /// Mirror of my response while the user is editing — committed to
  /// availability_responses on Save. Realtime UPDATEs on my own row are
  /// ignored (local state is the source of truth while editing).
  const [mineKeys, setMineKeys]   = useState<Set<string>>(new Set());
  const [saving, setSaving]       = useState(false);

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

    // realtime-js dedupes channels by topic and removeChannel() tears down
    // asynchronously, so a fast-refresh or quick remount can return a channel
    // that's still subscribed — and .on() after subscribe() throws. Adopt an
    // existing live channel as-is; only wire + subscribe + tear down one we
    // create.
    const topic = `poll:${poll.id}`;
    const existing = supabase
      .getChannels()
      .find((c) => c.topic === `realtime:${topic}`);
    const ch = existing ?? supabase.channel(topic);

    if (!existing) {
      ch.on(
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
    }
    channelRef.current = ch;
    return () => {
      if (!existing) supabase.removeChannel(ch);
      channelRef.current = null;
    };
  }, [visible, poll?.id, meId, onClose]);

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

      // Continue the flow: if my saved marks overlap the partner's, offer
      // to propose one of those times right now instead of dead-ending.
      const overlap = overlapCellKeys(mineKeys, theirKeys);
      if (overlap.length > 0 && onProposeTime) {
        Alert.alert(
          overlap.length === 1
            ? '1 time works for both of you'
            : `${overlap.length} times work for both of you`,
          'Propose one now? You can pick from the matching times.',
          [
            { text: 'Later', style: 'cancel', onPress: onClose },
            { text: 'Propose a time', onPress: onProposeTime },
          ],
        );
      } else {
        onClose();
      }
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
                <HardShadow radius={999} offset={4} style={saving ? styles.saveBtnDisabled : undefined}>
                  <Pressable
                    onPress={handleSave}
                    disabled={saving}
                    style={styles.saveBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Save your available times"
                  >
                    <Text style={styles.saveBtnText}>
                      {saving ? 'Saving…' : 'Save times'}
                    </Text>
                  </Pressable>
                </HardShadow>
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
    // Hard offset edge comes from the <HardShadow> wrapper — RN shadow
    // props render nothing on Android and were off-vocabulary anyway.
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: {
    fontFamily: AmbitFont.body,
    fontSize: 15,
    fontWeight: '700',
    color: Brand.actionInk,
  },
});
