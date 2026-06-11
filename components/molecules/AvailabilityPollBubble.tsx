import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  listAvailabilityResponses,
  overlapCellKeys,
  selectedCellKeys,
  type AvailabilityPollRow,
  type AvailabilityResponseRow,
} from '../../lib/availability';
import { supabase } from '../../lib/supabase';
import { AmbitFont, Brand } from '../../constants/theme';
import { StructuredHeader, structuredStyles } from './structuredCard';
import { HardShadow, Tactile } from '../atoms';

interface Props {
  poll:   AvailabilityPollRow;
  isMine: boolean;
  meId:   string;
  /// Tap on the mark/edit action → caller surfaces the full poll modal.
  onOpen: () => void;
  /// Tap on "Propose a time" (shown once both sides marked and overlap
  /// exists) → caller opens the SchedulingComposer, which pre-fills the
  /// overlap slots from this poll.
  onProposeTime: () => void;
}

/// In-thread card for an availability poll — the PIPELINE surface for the
/// find-a-time flow. Rather than a static "Open poll" button, it tracks
/// both responses live and always shows the current state + the single
/// next action:
///   you haven't marked      → "Mark your times"
///   waiting on them         → status line + "Edit your times" link
///   overlap exists          → "N times work for both" + "Propose a time"
///   marked but no overlap   → "Edit your times"
/// Closed polls flatten to a settled line; the confirmed meeting bubble
/// (created via propose → accept) handles the calendar add.
export function AvailabilityPollBubble({ poll, isMine, meId, onOpen, onProposeTime }: Props) {
  const isOpen   = poll.status === 'open';
  const isClosed = poll.status === 'closed';

  // Live responses — fetched on mount, kept fresh via realtime while the
  // poll is open. `null` = still loading (render the neutral state).
  const [responses, setResponses] = useState<AvailabilityResponseRow[] | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    listAvailabilityResponses(poll.id)
      .then((r) => { if (!cancelled) setResponses(r); })
      .catch(() => { if (!cancelled) setResponses([]); });

    // realtime-js dedupes channels by topic and removeChannel() tears down
    // asynchronously, so a fast-refresh or quick remount can return a channel
    // that's still subscribed — and .on() after subscribe() throws. Adopt an
    // existing live channel as-is; only wire + subscribe + tear down one we
    // create.
    const topic = `poll-pipeline:${poll.id}`;
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
          setResponses((prev) => {
            const without = (prev ?? []).filter((r) => r.user_id !== row.user_id);
            return payload.eventType === 'DELETE' ? without : [...without, row];
          });
        },
      ).subscribe();
    }

    return () => {
      cancelled = true;
      if (!existing) supabase.removeChannel(ch);
    };
  }, [poll.id, isOpen]);

  const { mineMarked, theirsMarked, overlapCount } = useMemo(() => {
    const mine   = responses?.find((r) => r.user_id === meId);
    const theirs = responses?.find((r) => r.user_id !== meId);
    const mineMarked   = (mine?.selected_slots?.length ?? 0) > 0;
    const theirsMarked = (theirs?.selected_slots?.length ?? 0) > 0;
    const overlapCount = mineMarked && theirsMarked
      ? overlapCellKeys(
          selectedCellKeys(mine!.selected_slots),
          selectedCellKeys(theirs!.selected_slots),
        ).length
      : 0;
    return { mineMarked, theirsMarked, overlapCount };
  }, [responses, meId]);

  // ── Pipeline state → status line + actions ─────────────────────────
  let statusLine: string | null = null;
  let primary:   { label: string; onPress: () => void } | null = null;
  let secondary: { label: string; onPress: () => void } | null = null;

  if (isOpen) {
    if (responses === null) {
      // Loading — neutral entry, no premature status.
      primary = { label: 'Mark your times', onPress: onOpen };
    } else if (!mineMarked) {
      statusLine = theirsMarked
        ? 'They marked their times — your move'
        : 'Your move — mark when you’re free';
      primary = { label: 'Mark your times', onPress: onOpen };
    } else if (!theirsMarked) {
      statusLine = 'Waiting on them to mark their times';
      secondary  = { label: 'Edit your times', onPress: onOpen };
    } else if (overlapCount > 0) {
      statusLine = overlapCount === 1
        ? '1 time works for both of you'
        : `${overlapCount} times work for both of you`;
      primary   = { label: 'Propose a time', onPress: onProposeTime };
      secondary = { label: 'Edit your times', onPress: onOpen };
    } else {
      statusLine = 'No overlap yet — try widening your times';
      primary = { label: 'Edit your times', onPress: onOpen };
    }
  }

  return (
    <View style={[isMine ? structuredStyles.surfaceDark : structuredStyles.surfaceLight]}>
      <StructuredHeader label="FIND A TIME" title={poll.title} dark={isMine} />

      <Text style={styles.subline}>
        {formatRange(poll)} · {poll.day_start_hour}:00–{poll.day_end_hour}:00
      </Text>

      {statusLine !== null && (
        <Text style={styles.statusLine}>{statusLine}</Text>
      )}

      {primary && (
        <HardShadow radius={999} offset={4} style={styles.primaryShadow}>
          <Tactile
            onPress={primary.onPress}
            haptic="tap"
            style={styles.primaryBtn}
            accessibilityLabel={primary.label}
          >
            <Text style={styles.primaryBtnText}>{primary.label}</Text>
          </Tactile>
        </HardShadow>
      )}

      {secondary && (
        <Pressable
          onPress={secondary.onPress}
          hitSlop={6}
          style={styles.secondaryBtn}
          accessibilityRole="button"
          accessibilityLabel={secondary.label}
        >
          <Text style={styles.secondaryBtnText}>{secondary.label}</Text>
        </Pressable>
      )}

      {!isOpen && (
        <Text style={styles.settledText}>
          {isClosed ? 'Settled — meeting confirmed in this thread' : 'Cancelled'}
        </Text>
      )}
    </View>
  );
}

function formatRange(poll: AvailabilityPollRow): string {
  const [sy, sm, sd] = poll.start_date.split('-').map(Number);
  const [ey, em, ed] = poll.end_date.split('-').map(Number);
  const start = new Date(sy, sm - 1, sd);
  const end   = new Date(ey, em - 1, ed);
  const fmt   = (d: Date) => d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  if (poll.start_date === poll.end_date) return fmt(start);
  return `${fmt(start)} – ${fmt(end)}`;
}

const styles = StyleSheet.create({
  subline: {
    fontFamily: AmbitFont.body,
    fontSize: 13,
    color: Brand.inkBody,
  },
  statusLine: {
    fontFamily: AmbitFont.body,
    fontSize: 13,
    fontWeight: '600',
    color: Brand.inkPrimary,
    marginTop: 2,
  },

  primaryShadow: { marginTop: 4 },
  primaryBtn: {
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: Brand.action,
    borderWidth: 1.6,
    borderColor: Brand.actionInk,
    alignItems: 'center',
  },
  primaryBtnText: {
    fontFamily: AmbitFont.body,
    fontSize: 15,
    fontWeight: '700',
    color: Brand.actionInk,
  },

  secondaryBtn: { alignSelf: 'center', paddingVertical: 4 },
  secondaryBtnText: {
    fontFamily: AmbitFont.body,
    fontSize: 13,
    fontWeight: '600',
    color: Brand.actionDeep,
  },

  settledText: {
    fontFamily: AmbitFont.body,
    fontSize: 13,
    color: Brand.inkMuted,
    fontStyle: 'italic',
    marginTop: 2,
  },
});
