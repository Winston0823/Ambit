import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CalendarBlank, CalendarCheck, CalendarX } from 'phosphor-react-native';
import type { AvailabilityPollRow } from '../../lib/availability';
import { AmbitFont, Brand, Radii } from '../../constants/theme';

interface Props {
  poll:   AvailabilityPollRow;
  isMine: boolean;
  /// Tap "Open" → caller surfaces the full poll modal for marking
  /// availability or finalizing an overlap slot.
  onOpen: () => void;
}

/// Compact card representing an availability poll in the thread.
/// Closed polls flatten to a static "Locked in" line; the real
/// scheduling bubble (from settled_scheduling_request_id) sits in
/// its own message right below and handles calendar add.
export function AvailabilityPollBubble({ poll, isMine, onOpen }: Props) {
  const isOpen      = poll.status === 'open';
  const isClosed    = poll.status === 'closed';
  const isCancelled = poll.status === 'cancelled';

  const headerIcon = isOpen ? CalendarBlank : isClosed ? CalendarCheck : CalendarX;
  const HeaderIcon = headerIcon;

  return (
    <View style={[styles.card, isMine && styles.cardMine]}>
      <View style={styles.headerRow}>
        <HeaderIcon
          size={16}
          color={isMine ? Brand.primary : Brand.accent}
          weight="bold"
        />
        <Text style={[styles.headerText, isMine && styles.accentMine]} numberOfLines={1}>
          {poll.title}
        </Text>
      </View>

      <Text style={[styles.subline, isMine && styles.subTextOnBrand]}>
        {formatRange(poll)} · {poll.day_start_hour}:00–{poll.day_end_hour}:00
      </Text>

      {isOpen ? (
        <Pressable
          onPress={onOpen}
          style={[styles.openBtn, isMine && styles.openBtnMine]}
        >
          <Text style={[styles.openBtnText, isMine && styles.accentMine]}>
            Open availability poll
          </Text>
        </Pressable>
      ) : (
        <Text style={[styles.statusText, isMine && styles.subTextOnBrand]}>
          {isClosed ? 'Locked in — see meeting below' : 'Cancelled'}
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
  card: {
    width: 280,
    borderRadius: Radii.lg,
    // Incoming (theirs) fill — matches incoming text bubbles (#ECE9E2) so
    // the card is clearly a bubble on the white canvas; surface1 was too
    // pale. `cardMine` overrides to tan.
    backgroundColor: '#ECE9E2',
    padding: 12,
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  // Outgoing (mine) — dark nav-bar surface matching my message bubbles,
  // tan accents on icon / eyebrow / CTA; body lines stay light via
  // subTextOnBrand. Keeps a faint warm-tan lift shadow.
  cardMine: {
    backgroundColor: Brand.navBarBg,
    shadowColor: Brand.accent,
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
  },
  accentMine: { color: Brand.primary },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerText: {
    flex: 1,
    fontFamily: AmbitFont.body,
    fontSize: 13,
    fontWeight: '700',
    color: Brand.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  textOnBrand: { color: Brand.canvas },

  subline: {
    fontFamily: AmbitFont.body,
    fontSize: 13,
    color: Brand.inkBody,
  },
  subTextOnBrand: { color: 'rgba(255,255,255,0.9)' },

  openBtn: {
    marginTop: 4,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Brand.canvas,
    borderWidth: 1,
    borderColor: Brand.borderDefault,
    alignItems: 'center',
  },
  openBtnMine: {
    backgroundColor: 'rgba(212,180,144,0.18)',
    borderColor: 'rgba(212,180,144,0.45)',
  },
  openBtnText: {
    fontFamily: AmbitFont.body,
    fontSize: 13,
    fontWeight: '600',
    color: Brand.accent,
  },

  statusText: {
    fontFamily: AmbitFont.body,
    fontSize: 13,
    color: Brand.inkMuted,
    fontStyle: 'italic',
    marginTop: 2,
  },
});
