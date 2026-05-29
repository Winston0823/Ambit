import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Clock, X } from 'phosphor-react-native';
import type { InboxItem } from '../../lib/messaging';
import { isReachedOutToYou } from '../../lib/messaging';
import { getAutoCloseCountdown } from '../../lib/closureLoop';
import { Brand } from '../../constants/theme';

interface Props {
  item:    InboxItem;
  meId:    string;
  onPress: () => void;
  /// Left-swipe → Pass. Parent owns the PassReasonSheet.
  onPassRequest?: (conversationId: string) => void;
  /// Long-press → toggle pin via parent (the parent decides whether to
  /// show a confirmation toast on pin-limit-reached).
  onLongPress?: (item: InboxItem) => void;
}

/// Inbox row (v4). Three visual states share the same skeleton:
///
///   • pending — the partner reached out and we haven't replied. Soft
///     peach-cream card, Fraunces-italic preview reads as a quote from
///     them, countdown chip is the only action affordance.
///   • active — any conversation that doesn't fit the above and isn't
///     auto-closed. White card. Optional "Reply" / "Hired" chip.
///   • auto-closed — terminal. Same shape, 55% opacity.
export function InboxRow({ item, meId, onPress, onPassRequest, onLongPress }: Props) {
  const initial = (item.partner_name ?? '?').slice(0, 1).toUpperCase();
  const swipeRef = useRef<Swipeable>(null);
  const sentByMe  = item.last_message_sender_id === meId;
  const isPending = isReachedOutToYou(item, meId);
  const isClosed  = item.status === 'passed' || item.status === 'auto_declined';
  const passable  = item.status === 'active' && !!onPassRequest;

  // Countdown ticks the label once a minute when the card is pending.
  // Cheap timer; only the label string updates so the rest of the
  // tree doesn't re-render.
  const [nowTick, setNowTick] = useState(0);
  useEffect(() => {
    if (!isPending) return;
    const t = setInterval(() => setNowTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, [isPending]);
  const countdown = useMemo(
    () => (isPending ? getAutoCloseCountdown(item.auto_decline_at) : null),
    // nowTick is intentionally a dep — re-read at minute boundaries.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isPending, item.auto_decline_at, nowTick],
  );

  const handlePass = () => {
    swipeRef.current?.close();
    if (onPassRequest) onPassRequest(item.conversation_id);
  };
  const handleLongPress = () => {
    if (onLongPress) onLongPress(item);
  };

  // Right-swipe action panel — same as the previous design, kept here
  // because the gesture is independent of the visual refresh.
  const renderRightActions = (progress: Animated.AnimatedInterpolation<number>) => {
    if (!passable) return null;
    const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [80, 0] });
    return (
      <Animated.View style={[styles.actionWrap, { transform: [{ translateX }] }]}>
        <Pressable onPress={handlePass} style={styles.passAction} accessibilityLabel="Pass">
          <X size={18} color="#FFFFFF" weight="bold" />
          <Text style={styles.passActionLabel}>Pass</Text>
        </Pressable>
      </Animated.View>
    );
  };

  // ── Derived display strings ──────────────────────────────────────
  const previewText = item.last_message_deleted
    ? 'Message deleted'
    : item.last_message_body
      ? item.last_message_body
      : item.last_message_attachment_url
        ? 'Photo'
        : 'Say hi';

  const previewPrefix = isPending
    ? null
    : sentByMe
      ? 'You: '
      : null;

  // Pending byline: "PROJECT · REACHED OUT TO YOU".
  // Active byline:  "PROJECT".
  // Closed byline:  "AUTO-CLOSED · MISSED REACH OUT" or "PASSED · ..."
  const bylineProject = (item.project_title ?? '').toUpperCase();
  const bylineSuffix =
    item.status === 'auto_declined' ? 'Missed reach out'
    : item.status === 'passed'      ? 'Passed'
    : item.status === 'hired'       ? null
    : isPending                     ? 'Reached out to you'
    : null;

  // Status chip below the preview. Stitch direction keeps this quiet:
  // only Hired and the countdown render. "Reply" is implied by the
  // byline + preview prefix, not a chip.
  const showHiredChip = item.status === 'hired';

  return (
    <Swipeable
      ref={swipeRef}
      enabled={passable}
      renderRightActions={renderRightActions}
      friction={2}
      rightThreshold={36}
    >
      <Pressable
        onPress={onPress}
        onLongPress={handleLongPress}
        delayLongPress={300}
        style={({ pressed }) => [
          styles.card,
          isPending && styles.cardPending,
          isClosed  && styles.cardClosed,
          pressed   && { opacity: 0.75 },
        ]}
      >
        {/* Top row: avatar + (name above byline) on the left, time on the right */}
        <View style={styles.topRow}>
          <View style={styles.topLeft}>
            <View style={[styles.avatarWrap, isClosed && styles.avatarClosed]}>
              {item.partner_photo_url ? (
                <Image source={{ uri: item.partner_photo_url }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarInitial}>{initial}</Text>
                </View>
              )}
            </View>
            <View style={styles.nameBlock}>
              <Text style={[styles.name, isClosed && styles.nameClosed]} numberOfLines={1}>
                {item.partner_name ?? 'Someone'}
              </Text>
              {bylineProject ? (
                <Text
                  style={[
                    styles.byline,
                    isPending && styles.bylinePending,
                    isClosed && styles.bylineClosed,
                  ]}
                  numberOfLines={1}
                >
                  {bylineProject}
                  {bylineSuffix ? (
                    <>
                      <Text style={styles.bylineSep}>  ·  </Text>
                      <Text>{bylineSuffix.toUpperCase()}</Text>
                    </>
                  ) : null}
                </Text>
              ) : null}
            </View>
          </View>
          <Text style={styles.time}>{formatRelative(item.last_message_at)}</Text>
        </View>

        {/* Preview + chip live in the full card width with a left
            indent equal to the avatar + gap, so they align under the
            name rather than under the avatar. */}
        <View style={styles.subBlock}>
          <Text
            style={[
              styles.preview,
              isPending && styles.previewPending,
              isClosed  && styles.previewClosed,
            ]}
            numberOfLines={1}
          >
            {previewPrefix && (
              <Text style={styles.previewPrefix}>{previewPrefix}</Text>
            )}
            {previewText}
          </Text>

          {(countdown || showHiredChip) && (
            <View style={styles.chipRow}>
              {countdown && (
                <View style={[styles.chip, styles.chipOutline]}>
                  <Clock size={11} color={Brand.inboxBronze} weight="bold" />
                  <Text style={styles.chipText}>{countdown.label}</Text>
                </View>
              )}
              {showHiredChip && (
                <View style={[styles.chip, styles.chipSolid]}>
                  <Text style={[styles.chipText, styles.chipTextSolid]}>Hired</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </Pressable>
    </Swipeable>
  );
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now  = Date.now();
  const sec = Math.floor((now - then) / 1000);
  if (sec < 60)    return 'now';
  if (sec < 3600)  return `${Math.floor(sec / 60)} min`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
  const days = Math.floor(sec / 86400);
  if (days === 1) return 'Yesterday';
  if (days < 7)   return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const AVATAR_SIZE = 48;
const AVATAR_GAP  = 14;
const SUB_INDENT  = AVATAR_SIZE + AVATAR_GAP;

const styles = StyleSheet.create({
  // Active rows are flat — no fill, no border, just padding. The
  // hairline divider between rows is provided by the screen-level
  // ItemSeparatorComponent.
  card: {
    backgroundColor: Brand.inboxCardActive, // 'transparent'
    paddingVertical: 14,
    paddingHorizontal: 4,
    gap: 8,
  },
  // Pending rows become soft golden-cream cards with a generous radius.
  cardPending: {
    backgroundColor: Brand.inboxCardPending,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Brand.inboxBorderTan,
    padding: 18,
  },
  cardClosed: { opacity: 0.55 },

  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  topLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AVATAR_GAP,
    flex: 1,
    minWidth: 0,
  },
  nameBlock: { flex: 1, minWidth: 0 },

  // Indent past the avatar so preview + chip align under the name.
  subBlock: {
    paddingLeft: SUB_INDENT,
    gap: 10,
  },

  // Avatar — rounded square (Stitch direction), pale gray fill,
  // italic bronze monogram. 48pt with 12pt radius.
  avatarWrap: { width: AVATAR_SIZE, height: AVATAR_SIZE },
  avatar: { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: 12 },
  avatarFallback: {
    backgroundColor: Brand.inboxAvatarBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarClosed: {},
  avatarInitial: {
    fontFamily: 'Zodiak-Bold',
    fontStyle: 'italic',
    fontSize: 18,
    color: Brand.inboxBronzeDim,
    letterSpacing: -0.2,
  },
  byline: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.6,
    color: Brand.inboxBronze,
  },
  bylinePending: { color: Brand.inboxBronze },
  bylineClosed:  { color: Brand.inboxInkMute },
  bylineProject: { color: Brand.inboxBronze },
  bylineSep:     { color: Brand.inboxBronze },
  time: {
    fontSize: 11,
    fontWeight: '600',
    color: Brand.inboxInkMute,
    letterSpacing: 0.04,
  },

  name: {
    fontFamily: 'Zodiak-Bold',
    fontStyle: 'italic',
    fontSize: 20,
    color: Brand.inboxInkPrimary,
    letterSpacing: -0.3,
    lineHeight: 24,
  },
  nameClosed: { color: Brand.inboxInkMute },

  preview: {
    fontSize: 14,
    color: Brand.inboxInkBody,
    lineHeight: 19,
  },
  previewPending: {
    // Synthesized italic on Plus Jakarta — the pending preview reads
    // as a quoted line from the partner ("their voice"). When a real
    // serif italic ships we'll swap fontFamily here.
    fontStyle: 'italic',
    fontSize: 14,
  },
  previewClosed: { color: Brand.inboxInkMute },
  previewPrefix: { fontWeight: '700', color: Brand.inboxInkPrimary },

  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  // Stitch chip family — pale neutral surfaces with bronze accents,
  // never solid ink. Countdown urgent flips to solid bronze.
  chipOutline: {
    borderColor: 'rgba(118,90,38,0.15)',
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  chipSolid: {
    borderColor: 'transparent',
    backgroundColor: Brand.inboxChipHired,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '700',
    color: Brand.inboxBronze,
    letterSpacing: 0.02,
  },
  chipTextSolid: { color: Brand.inboxInkPrimary },

  // Swipe-action panel (kept from v3)
  actionWrap: {
    width: 80,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#C0392B',
  },
  passAction: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  passActionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: '#FFFFFF',
  },
});
