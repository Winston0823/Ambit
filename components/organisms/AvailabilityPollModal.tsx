import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { CalendarCheck, X } from 'phosphor-react-native';
import {
  buildGrid,
  busyCellKeys,
  finalizeAvailabilityPoll,
  formatCellLabel,
  listAvailabilityResponses,
  overlapCellKeys,
  selectedCellKeys,
  setAvailabilityResponse,
  type AvailabilityPollRow,
  type AvailabilityResponseRow,
} from '../../lib/availability';
import { getBusyEvents } from '../../lib/deviceCalendar';
import { AvailabilityGrid } from '../molecules/AvailabilityGrid';
import { supabase } from '../../lib/supabase';
import { AmbitFont, Brand, Radii, Space } from '../../constants/theme';

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
  const [finalizing, setFinalizing] = useState(false);
  /// Mirror of my response while the user is editing — debounced into
  /// availability_responses. Realtime UPDATEs on my own row are ignored
  /// (caller is the source of truth for local state).
  const [mineKeys, setMineKeys]   = useState<Set<string>>(new Set());

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

  const overlapKeys = useMemo(
    () => overlapCellKeys(mineKeys, theirKeys),
    [mineKeys, theirKeys],
  );

  const toggleCell = (key: string) => {
    setMineKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleLockIn = async (cellKey: string) => {
    if (!poll || finalizing) return;
    const start = new Date(cellKey);
    const end   = new Date(start.getTime() + poll.duration_min * 60_000);
    Alert.alert(
      'Lock in this time?',
      `${formatCellLabel(start)} — ${formatTime(end)}\nThis closes the poll for both of you.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Lock in',
          onPress: async () => {
            setFinalizing(true);
            try {
              await finalizeAvailabilityPoll(poll.id, start, end);
              onClose();
            } catch (e: any) {
              Alert.alert('Could not lock in', e?.message ?? '');
            } finally {
              setFinalizing(false);
            }
          },
        },
      ],
    );
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

            <ScrollView
              style={styles.overlapPanel}
              contentContainerStyle={styles.overlapContent}
            >
              <Text style={styles.overlapTitle}>
                Overlapping times  ·  {overlapKeys.length}
              </Text>
              {overlapKeys.length === 0 ? (
                <Text style={styles.overlapEmpty}>
                  No overlap yet. Keep marking — they'll appear here when you both pick the same slot.
                </Text>
              ) : (
                overlapKeys.map((key) => (
                  <View key={key} style={styles.overlapRow}>
                    <CalendarCheck size={16} color={Brand.accent} weight="bold" />
                    <Text style={styles.overlapLabel}>{formatCellLabel(new Date(key))}</Text>
                    <Pressable
                      onPress={() => handleLockIn(key)}
                      disabled={finalizing}
                      style={[styles.lockBtn, finalizing && { opacity: 0.5 }]}
                    >
                      <Text style={styles.lockBtnText}>Lock in</Text>
                    </Pressable>
                  </View>
                ))
              )}
            </ScrollView>
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

function formatTime(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
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

  overlapPanel: {
    maxHeight: 220,
    backgroundColor: Brand.surface1,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Brand.borderDefault,
  },
  overlapContent: {
    paddingHorizontal: Space.lg,
    paddingVertical: Space.md,
    gap: 8,
  },
  overlapTitle: {
    fontFamily: AmbitFont.body,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: Brand.inkLabel,
  },
  overlapEmpty: {
    fontFamily: AmbitFont.body,
    fontSize: 13,
    color: Brand.inkMuted,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  overlapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: Brand.canvas,
    borderRadius: Radii.md,
  },
  overlapLabel: {
    flex: 1,
    fontFamily: AmbitFont.body,
    fontSize: 14,
    color: Brand.inkBody,
    fontWeight: '600',
  },
  lockBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Brand.action,
  },
  lockBtnText: {
    fontFamily: AmbitFont.body,
    fontSize: 13,
    fontWeight: '700',
    color: Brand.actionInk,
  },
});
