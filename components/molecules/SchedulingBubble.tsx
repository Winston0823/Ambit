import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CalendarBlank, CalendarCheck, CheckCircle, XCircle } from 'phosphor-react-native';
import type { SchedulingRequestRow, SchedulingSlot } from '../../lib/scheduling';
import {
  acceptMeeting,
  cancelMeeting,
  declineMeeting,
} from '../../lib/scheduling';
import {
  addAcceptedMeetingToCalendar,
  getStoredLocalEventId,
} from '../../lib/deviceCalendar';
import { AmbitFont, Brand, Radii } from '../../constants/theme';

interface Props {
  request: SchedulingRequestRow;
  meId:    string;
  /// Drives layout (right=mine, left=partner). The proposer's bubble
  /// (mine when I proposed) gets the warm-tan fill; the recipient's
  /// gets the neutral surface.
  isMine:  boolean;
}

/// In-thread card for a scheduling request. Replaces the regular
/// message body when MessageBubble sees scheduling_request_id set.
///
/// On accept, the recipient's device immediately tries to add the
/// event to the local default calendar (iCloud / Google / Outlook —
/// whatever they've set as primary on their phone). The proposer's
/// device, when realtime delivers the accept, shows an "Add to my
/// calendar" affordance — auto-adding without an explicit tap would
/// be surprising for a passive observer.
export function SchedulingBubble({ request, meId, isMine }: Props) {
  const [busy, setBusy] = useState(false);
  const [localEventId, setLocalEventId] = useState<string | null>(null);
  const isProposer = request.proposer_id === meId;

  // Reflect any previously-stored local-event id so the bubble shows
  // "Added to your calendar" on remount.
  useEffect(() => {
    let cancelled = false;
    if (request.status === 'accepted') {
      getStoredLocalEventId(request.id).then((id) => {
        if (!cancelled) setLocalEventId(id);
      });
    } else {
      setLocalEventId(null);
    }
    return () => {
      cancelled = true;
    };
  }, [request.id, request.status]);

  const handleAccept = async (slotIndex: number) => {
    if (busy) return;
    setBusy(true);
    try {
      await acceptMeeting(request.id, slotIndex);
      // Optimistically add the event using a synthesized "accepted" row.
      // The realtime UPDATE will re-render shortly with the same status.
      const accepted = {
        ...request,
        status: 'accepted' as const,
        accepted_slot: request.proposed_slots[slotIndex],
      };
      const id = await addAcceptedMeetingToCalendar(accepted);
      if (id) setLocalEventId(id);
    } catch (e: any) {
      Alert.alert('Could not accept', e?.message ?? '');
    } finally {
      setBusy(false);
    }
  };

  const handleDecline = () => {
    if (busy) return;
    Alert.alert('Decline this request?', undefined, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Decline',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await declineMeeting(request.id);
          } catch (e: any) {
            Alert.alert('Could not decline', e?.message ?? '');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const handleCancel = () => {
    if (busy) return;
    Alert.alert('Cancel this request?', undefined, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel request',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await cancelMeeting(request.id);
          } catch (e: any) {
            Alert.alert('Could not cancel', e?.message ?? '');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const handleAddToCalendar = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const id = await addAcceptedMeetingToCalendar(request);
      if (id) setLocalEventId(id);
      else Alert.alert('Calendar access denied', 'Enable Calendar access in Settings to add the event.');
    } catch (e: any) {
      Alert.alert('Could not add', e?.message ?? '');
    } finally {
      setBusy(false);
    }
  };

  // ── Render ────────────────────────────────────────────────
  if (request.status === 'accepted' && request.accepted_slot) {
    return (
      <View style={[styles.card, isMine && styles.cardMine]}>
        <Header title={request.title} isMine={isMine} />
        <View style={styles.confirmedRow}>
          <CheckCircle
            size={18}
            color={isMine ? Brand.canvas : Brand.accent}
            weight="fill"
          />
          <Text style={[styles.confirmedText, isMine && styles.textOnBrand]}>
            Confirmed for {formatSlot(request.accepted_slot)}
          </Text>
        </View>

        {localEventId ? (
          <View style={styles.addedRow}>
            <CalendarCheck
              size={14}
              color={isMine ? 'rgba(255,255,255,0.85)' : Brand.inkMuted}
              weight="regular"
            />
            <Text style={[styles.addedText, isMine && styles.addedTextMine]}>
              Added to your calendar
            </Text>
          </View>
        ) : (
          <Pressable
            onPress={handleAddToCalendar}
            disabled={busy}
            style={[styles.addBtn, isMine && styles.addBtnMine, busy && { opacity: 0.5 }]}
          >
            {busy ? (
              <ActivityIndicator color={isMine ? Brand.canvas : Brand.accent} />
            ) : (
              <>
                <CalendarBlank
                  size={14}
                  color={isMine ? Brand.canvas : Brand.accent}
                  weight="bold"
                />
                <Text style={[styles.addBtnText, isMine && styles.textOnBrand]}>
                  Add to my calendar
                </Text>
              </>
            )}
          </Pressable>
        )}
      </View>
    );
  }

  if (request.status === 'declined' || request.status === 'cancelled') {
    return (
      <View style={[styles.card, styles.cardTombstone, isMine && styles.cardMine]}>
        <Header title={request.title} isMine={isMine} />
        <View style={styles.confirmedRow}>
          <XCircle
            size={18}
            color={isMine ? 'rgba(255,255,255,0.7)' : Brand.inkMuted}
            weight="regular"
          />
          <Text style={[styles.tombstoneText, isMine && styles.tombstoneTextMine]}>
            {request.status === 'declined' ? 'Declined' : 'Cancelled'}
          </Text>
        </View>
      </View>
    );
  }

  // status === 'proposed'
  return (
    <View style={[styles.card, isMine && styles.cardMine]}>
      <Header title={request.title} isMine={isMine} />

      {isProposer ? (
        <Text style={[styles.waitingText, isMine && styles.textOnBrand]}>
          Waiting for a response…
        </Text>
      ) : null}

      <View style={styles.slotColumn}>
        {request.proposed_slots.map((slot, i) =>
          isProposer ? (
            <View key={i} style={styles.slotReadonly}>
              <Text style={[styles.slotText, isMine && styles.textOnBrand]}>
                {formatSlot(slot)}
              </Text>
            </View>
          ) : (
            <Pressable
              key={i}
              onPress={() => handleAccept(i)}
              disabled={busy}
              style={({ pressed }) => [
                styles.slotBtn,
                pressed && { opacity: 0.85 },
                busy && { opacity: 0.6 },
              ]}
            >
              <Text style={styles.slotBtnText}>{formatSlot(slot)}</Text>
            </Pressable>
          ),
        )}
      </View>

      <View style={styles.actionRow}>
        {busy ? (
          <ActivityIndicator color={isMine ? Brand.canvas : Brand.accent} />
        ) : isProposer ? (
          <Pressable onPress={handleCancel}>
            <Text style={[styles.linkBtnMine]}>Cancel request</Text>
          </Pressable>
        ) : (
          <Pressable onPress={handleDecline}>
            <Text style={styles.linkBtn}>Decline</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function Header({ title, isMine }: { title: string; isMine: boolean }) {
  return (
    <View style={styles.headerRow}>
      <CalendarBlank
        size={16}
        color={isMine ? Brand.canvas : Brand.accent}
        weight="bold"
      />
      <Text style={[styles.headerText, isMine && styles.textOnBrand]} numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
}

function formatSlot(slot: SchedulingSlot): string {
  const d = new Date(slot.start);
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month:   'short',
    day:     'numeric',
    hour:    'numeric',
    minute:  '2-digit',
  });
}

const styles = StyleSheet.create({
  card: {
    width: 280,
    borderRadius: Radii.lg,
    backgroundColor: Brand.surface1,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: Brand.borderDefault,
  },
  cardMine: {
    backgroundColor: Brand.primary,
    borderColor: Brand.primary,
  },
  cardTombstone: { opacity: 0.85 },

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

  waitingText: {
    fontFamily: AmbitFont.body,
    fontSize: 13,
    color: Brand.inkMuted,
    fontStyle: 'italic',
  },

  slotColumn: { gap: 6, marginTop: 4 },
  slotBtn: {
    backgroundColor: Brand.canvas,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: Radii.md,
    borderWidth: 1.5,
    borderColor: Brand.borderDefault,
  },
  slotBtnText: {
    fontFamily: AmbitFont.body,
    fontSize: 14,
    fontWeight: '600',
    color: Brand.inkPrimary,
  },
  slotReadonly: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radii.md,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  slotText: {
    fontFamily: AmbitFont.body,
    fontSize: 14,
    color: Brand.inkBody,
  },

  confirmedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  confirmedText: {
    flex: 1,
    fontFamily: AmbitFont.body,
    fontSize: 14,
    fontWeight: '600',
    color: Brand.inkPrimary,
  },
  tombstoneText: {
    flex: 1,
    fontFamily: AmbitFont.body,
    fontSize: 14,
    color: Brand.inkMuted,
    fontStyle: 'italic',
  },
  tombstoneTextMine: { color: 'rgba(255,255,255,0.85)' },

  addedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addedText: {
    fontFamily: AmbitFont.body,
    fontSize: 12,
    color: Brand.inkMuted,
  },
  addedTextMine: { color: 'rgba(255,255,255,0.85)' },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: Radii.md,
    backgroundColor: Brand.canvas,
    borderWidth: 1,
    borderColor: Brand.borderDefault,
  },
  addBtnMine: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderColor: 'rgba(255,255,255,0.3)',
  },
  addBtnText: {
    fontFamily: AmbitFont.body,
    fontSize: 13,
    fontWeight: '600',
    color: Brand.accent,
  },

  actionRow: {
    marginTop: 2,
    alignItems: 'flex-end',
  },
  linkBtn: {
    fontFamily: AmbitFont.body,
    fontSize: 13,
    fontWeight: '600',
    color: Brand.accent,
  },
  linkBtnMine: {
    fontFamily: AmbitFont.body,
    fontSize: 13,
    fontWeight: '600',
    color: Brand.canvas,
  },
});
