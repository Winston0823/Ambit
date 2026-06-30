import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  GestureResponderEvent,
  LayoutChangeEvent,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Brand, AmbitFont, StageRamp, StageColor } from '../../constants/theme';
import {
  ConversationStatus,
  OWNER_STAGES,
  OwnerStage,
} from '../../lib/closureLoop';

interface Props {
  /// Shared closure-loop status — drives the top (display-only) ladder.
  status: ConversationStatus;
  /// Whether a meeting time has been agreed (an accepted scheduling request).
  /// Lights the "Meeting" milestone between Talking and Proposed.
  meetingAgreed: boolean;
  /// Only the owner gets the private draggable funnel tag.
  isOwner: boolean;
  /// Current private stage (null → defaults to 'new').
  ownerStage: OwnerStage | null;
  /// Fired on snap to a new stage (owner only).
  onSetStage: (stage: OwnerStage) => void;
}

const KNOB = 22;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/// Two stacked sub-rails (kept separate for legibility, not overlaid):
///   1. Shared status ladder — Talking · Meeting · Proposed · Hired (or a muted
///      Closed terminal). Display-only; the binding propose/confirm/pass actions
///      live in the thread's StatusBanner + overflow menu. Colors track the
///      warm→cool StageRamp left→right (orange → yellow → green → blue).
///   2. Private funnel tag (owner only) — a color-coded knob the owner taps or
///      drags across New · Screening · Interviewing · Finalist (same ramp).
export function StageRail({ status, meetingAgreed, isOwner, ownerStage, onSetStage }: Props) {
  const closed = status === 'passed' || status === 'auto_declined';
  return (
    <View style={styles.root}>
      <SharedLadder status={status} meetingAgreed={meetingAgreed} closed={closed} />
      {isOwner && (
        <PrivateFunnel ownerStage={ownerStage ?? 'new'} onSetStage={onSetStage} />
      )}
    </View>
  );
}

// ── Shared status ladder (display) ─────────────────────────────────────────

const SHARED = [
  { label: 'Talking',  color: StageRamp[0] },
  { label: 'Meeting',  color: StageRamp[1] },
  { label: 'Proposed', color: StageRamp[2] },
  { label: 'Hired',    color: StageRamp[3] },
];

function statusStep(status: ConversationStatus, meetingAgreed: boolean): number {
  switch (status) {
    case 'active':        return meetingAgreed ? 1 : 0;
    case 'hired_pending': return 2;
    case 'hired':         return 3;
    default:              return -1; // closed
  }
}

function SharedLadder({
  status, meetingAgreed, closed,
}: { status: ConversationStatus; meetingAgreed: boolean; closed: boolean }) {
  const step = statusStep(status, meetingAgreed);
  return (
    <View style={styles.block}>
      <Text style={styles.eyebrow}>STATUS</Text>
      {closed ? (
        <View style={styles.closedPill}>
          <Text style={styles.closedText}>
            {status === 'passed' ? 'Passed' : 'Closed — no hire'}
          </Text>
        </View>
      ) : (
        <View style={styles.ladder}>
          {SHARED.map((s, i) => {
            const reached = i <= step;
            const current = i === step;
            return (
              <React.Fragment key={s.label}>
                {i > 0 && (
                  <View style={[styles.ladderLine, i <= step && { backgroundColor: SHARED[i].color }]} />
                )}
                <View style={styles.ladderNode}>
                  <View
                    style={[
                      styles.ladderDot,
                      reached && { backgroundColor: s.color, borderColor: s.color },
                      current && styles.ladderDotCurrent,
                    ]}
                  />
                  <Text style={[styles.ladderLabel, current && { color: Brand.inkPrimary, fontWeight: '700' }]}>
                    {s.label}
                  </Text>
                </View>
              </React.Fragment>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ── Private funnel tag (owner only, tap-or-drag) ───────────────────────────

function PrivateFunnel({
  ownerStage,
  onSetStage,
}: {
  ownerStage: OwnerStage;
  onSetStage: (stage: OwnerStage) => void;
}) {
  const N = OWNER_STAGES.length;
  const activeIdx = Math.max(0, OWNER_STAGES.findIndex((s) => s.value === ownerStage));
  const [trackW, setTrackW] = useState(0);
  const usable = Math.max(0, trackW - KNOB);
  const posFor = (i: number) => (N <= 1 ? 0 : (i / (N - 1)) * usable);

  // Non-native driver throughout: hx feeds both the knob transform and the
  // fill's layout width (can't be split across drivers).
  const hx = useRef(new Animated.Value(0)).current;
  const half = useRef(new Animated.Value(KNOB / 2)).current;
  const idxRef = useRef(activeIdx);
  const startRef = useRef(0);

  useEffect(() => {
    idxRef.current = activeIdx;
    Animated.spring(hx, { toValue: posFor(activeIdx), friction: 9, tension: 90, useNativeDriver: false }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIdx, trackW]);

  const nearestIdx = (x: number) => {
    if (usable <= 0) return idxRef.current;
    return clamp(Math.round((x / usable) * (N - 1)), 0, N - 1);
  };
  // Touch x within the track → knob-left position (centered on the finger).
  const xFromTouch = (e: GestureResponderEvent) => clamp(e.nativeEvent.locationX - KNOB / 2, 0, usable);

  const pan = useMemo(
    () =>
      PanResponder.create({
        // Claim the touch immediately so the parent ScrollView never steals the
        // drag (the track is a thin dedicated control). This was the bug — the
        // gesture lived on the tiny knob and never won the responder.
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          const x = xFromTouch(e);
          startRef.current = x;
          hx.setValue(x);
        },
        onPanResponderMove: (_e, g) => {
          hx.setValue(clamp(startRef.current + g.dx, 0, usable));
        },
        onPanResponderRelease: (_e, g) => {
          const i = nearestIdx(clamp(startRef.current + g.dx, 0, usable));
          if (i !== idxRef.current) {
            if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
            idxRef.current = i;
            onSetStage(OWNER_STAGES[i].value);
          }
          Animated.spring(hx, { toValue: posFor(i), friction: 9, tension: 90, useNativeDriver: false }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(hx, { toValue: posFor(idxRef.current), friction: 9, tension: 90, useNativeDriver: false }).start();
        },
      }),
    // usable derives from trackW; recreate when it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trackW],
  );

  const color = StageColor[ownerStage];
  const onTrackLayout = (e: LayoutChangeEvent) => setTrackW(e.nativeEvent.layout.width);

  return (
    <View style={styles.block}>
      <View style={styles.privateHead}>
        <Text style={styles.eyebrow}>YOUR STAGE</Text>
        <Text style={[styles.stageNow, { color }]}>{OWNER_STAGES[activeIdx].label}</Text>
      </View>

      {/* The whole track is the hit target (tap to set, or drag the knob). */}
      <View style={styles.track} onLayout={onTrackLayout} {...pan.panHandlers}>
        <View style={styles.trackLine} pointerEvents="none" />
        <Animated.View pointerEvents="none" style={[styles.trackFill, { backgroundColor: color, width: Animated.add(hx, half) }]} />
        {OWNER_STAGES.map((_, i) => (
          <View key={i} pointerEvents="none" style={[styles.tick, { left: posFor(i) + KNOB / 2 - 2, backgroundColor: i <= activeIdx ? color : Brand.borderDefault }]} />
        ))}
        <Animated.View pointerEvents="none" style={[styles.knob, { backgroundColor: color, transform: [{ translateX: hx }] }]} />
      </View>

      <View style={styles.tickLabels} pointerEvents="none">
        {OWNER_STAGES.map((s, i) => (
          <Text key={s.value} style={[styles.tickLabel, i === activeIdx && { color: Brand.inkBody, fontWeight: '700' }]}>
            {s.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 22, paddingVertical: 4 },
  block: { gap: 12 },
  eyebrow: {
    fontFamily: AmbitFont.body,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: Brand.inkLabel,
  },

  // shared ladder (4 nodes, flex so they fit the card width)
  ladder: { flexDirection: 'row', alignItems: 'flex-start' },
  ladderNode: { alignItems: 'center', paddingHorizontal: 2 }, // sizes to its label
  ladderLine: { flex: 1, height: 2, backgroundColor: Brand.borderDefault, marginTop: 7, marginHorizontal: -2 },
  ladderDot: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: Brand.surface2, borderWidth: 1.5, borderColor: Brand.borderDefault,
  },
  ladderDotCurrent: { transform: [{ scale: 1.15 }] },
  ladderLabel: { fontFamily: AmbitFont.body, fontSize: 11.5, color: Brand.inkMuted, marginTop: 6 },
  closedPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    backgroundColor: Brand.surface2,
  },
  closedText: { fontFamily: AmbitFont.body, fontSize: 13, fontWeight: '600', color: Brand.inkLabel },

  // private funnel
  privateHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  stageNow: { fontFamily: AmbitFont.display, fontSize: 18 },
  track: { height: 34, justifyContent: 'center' }, // taller hit zone for the drag
  trackLine: {
    position: 'absolute', left: KNOB / 2, right: KNOB / 2, top: 15, height: 4, borderRadius: 2,
    backgroundColor: Brand.surface2,
  },
  trackFill: { position: 'absolute', left: 0, top: 15, height: 4, borderRadius: 2 },
  tick: { position: 'absolute', top: 15, width: 4, height: 4, borderRadius: 2 },
  knob: {
    width: KNOB, height: KNOB, borderRadius: KNOB / 2,
    borderWidth: 2, borderColor: Brand.cardCream,
    shadowColor: Brand.inkEdge, shadowOpacity: 0.25, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 3,
  },
  tickLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  tickLabel: { fontFamily: AmbitFont.body, fontSize: 11, color: Brand.inkMuted, flex: 1, textAlign: 'center' },
});
