import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Archive, ArrowBendUpLeft, Bell, BellSlash, Clock, PushPin, X } from 'phosphor-react-native';
import type { InboxItem } from '../../lib/messaging';
import { inboxState, isReachedOutToYou } from '../../lib/messaging';
import { getAutoCloseCountdown } from '../../lib/closureLoop';
import { HardShadow } from '../atoms';
import { AmbitFont, Brand, Radii } from '../../constants/theme';

interface Props {
  item:    InboxItem;
  meId:    string;
  onPress: () => void;
  /// Left-swipe → Pass. Parent owns the PassReasonSheet.
  onPassRequest?: (conversationId: string) => void;
  /// Left-swipe → toggle pin (revealed beside Pass). Parent surfaces the
  /// pin-limit-reached toast.
  onPin?: (item: InboxItem) => void;
  /// Left-swipe → Mute / Archive (per-participant).
  onMute?: (item: InboxItem) => void;
  onArchive?: (item: InboxItem) => void;
}

/// Inbox row (v4). Three visual states share the same skeleton:
///
///   • pending — the partner reached out and we haven't replied. Soft
///     peach-cream card, Fraunces-italic preview reads as a quote from
///     them, countdown chip is the only action affordance.
///   • active — any conversation that doesn't fit the above and isn't
///     auto-closed. White card. Optional "Reply" / "Hired" chip.
///   • auto-closed — terminal. Same shape, 55% opacity.
export function InboxRow({ item, meId, onPress, onPassRequest, onPin, onMute, onArchive }: Props) {
  const initial = (item.partner_name ?? '?').slice(0, 1).toUpperCase();
  const swipeRef = useRef<Swipeable>(null);
  const sentByMe  = item.last_message_sender_id === meId;
  const isPending = isReachedOutToYou(item, meId);
  const isClosed  = item.status === 'passed' || item.status === 'auto_declined';
  const passable  = item.status === 'active' && !!onPassRequest;
  const canPin    = !!onPin;
  const isPinned  = !!item.is_pinned;
  // "Your turn" on active, non-pending rows where they sent last (pending rows
  // already signal it via the countdown chip, so we don't double up).
  const yourTurnChip =
    !isPending && !isClosed && item.status === 'active' && inboxState(item, meId) === 'your_turn';

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
  const handlePin = () => {
    swipeRef.current?.close();
    if (onPin) onPin(item);
  };

  // Right-edge reveal (swipe-left): Pin sits beside Pass, both as inset buttons
  // on one persistent ink panel — the row's hard-shadow black extended to full
  // height — so the actions read as sections of the card's bubble language, not
  // floating tiles each with their own shadow.
  const panelWidth = (count: number) => count * BTN_W + (count + 1) * PANEL_PAD;

  const renderRightActions = (progress: Animated.AnimatedInterpolation<number>) => {
    if (!passable && !canPin) return null;
    const count = (canPin ? 1 : 0) + (passable ? 1 : 0);
    const total = panelWidth(count);
    const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [total, 0] });
    return (
      <Animated.View style={[styles.actionOuter, { width: total, transform: [{ translateX }] }]}>
        <View style={[styles.actionPanel, styles.actionPanelRight, { width: total + PANEL_OVERLAP }]}>
          {canPin && (
            <Pressable
              onPress={handlePin}
              style={[styles.actionBtn, styles.pinBtn]}
              accessibilityLabel={isPinned ? 'Unpin' : 'Pin'}
            >
              <PushPin size={18} color={Brand.inkOnBrand} weight={isPinned ? 'fill' : 'bold'} />
              <Text style={styles.actionLabel}>{isPinned ? 'Unpin' : 'Pin'}</Text>
            </Pressable>
          )}
          {passable && (
            <Pressable onPress={handlePass} style={[styles.actionBtn, styles.passBtn]} accessibilityLabel="Pass">
              <X size={18} color={Brand.inkOnBrand} weight="bold" />
              <Text style={styles.actionLabel}>Pass</Text>
            </Pressable>
          )}
        </View>
      </Animated.View>
    );
  };

  // Left-edge reveal (swipe-right): Mute / Archive on the same ink panel.
  const renderLeftActions = (progress: Animated.AnimatedInterpolation<number>) => {
    if (!onMute && !onArchive) return null;
    const count = (onMute ? 1 : 0) + (onArchive ? 1 : 0);
    const total = panelWidth(count);
    const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [-total, 0] });
    return (
      <Animated.View style={[styles.actionOuter, { width: total, transform: [{ translateX }] }]}>
        <View style={[styles.actionPanel, styles.actionPanelLeft, { width: total + PANEL_OVERLAP }]}>
          {onMute && (
            <Pressable
              onPress={() => { swipeRef.current?.close(); onMute(item); }}
              style={[styles.actionBtn, styles.muteBtn]}
              accessibilityLabel={item.is_muted ? 'Unmute' : 'Mute'}
            >
              {item.is_muted
                ? <Bell size={18} color={Brand.inkOnBrand} weight="bold" />
                : <BellSlash size={18} color={Brand.inkOnBrand} weight="bold" />}
              <Text style={styles.actionLabel}>{item.is_muted ? 'Unmute' : 'Mute'}</Text>
            </Pressable>
          )}
          {onArchive && (
            <Pressable
              onPress={() => { swipeRef.current?.close(); onArchive(item); }}
              style={[styles.actionBtn, styles.archiveBtn]}
              accessibilityLabel="Archive"
            >
              <Archive size={18} color={Brand.inkOnBrand} weight="bold" />
              <Text style={styles.actionLabel}>Archive</Text>
            </Pressable>
          )}
        </View>
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
    // One crisp ink edge runs under the whole row (card + revealed actions) via
    // this single full-width HardShadow. The Swipeable clips its own bounds, so
    // the shadow must live outside it. Closed rows drop the backing (transparent)
    // since a solid block would bleed through the translucent card.
    <HardShadow
      radius={Radii.card}
      offset={4}
      color={isClosed ? 'transparent' : undefined}
      style={styles.rowWrap}
    >
    <Swipeable
      ref={swipeRef}
      enabled={passable || canPin || !!onMute || !!onArchive}
      renderRightActions={renderRightActions}
      renderLeftActions={renderLeftActions}
      friction={2}
      rightThreshold={36}
      leftThreshold={40}
    >
      <Pressable
        onPress={onPress}
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
          <View style={styles.timeRow}>
            {item.is_muted && <BellSlash size={12} color={Brand.inkBody} weight="bold" />}
            <Text style={styles.time}>{formatRelative(item.last_message_at)}</Text>
          </View>
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

          {(countdown || showHiredChip || yourTurnChip) && (
            <View style={styles.chipRow}>
              {countdown && (
                <View style={[styles.chip, styles.chipOutline]}>
                  <Clock size={11} color={Brand.inkLabel} weight="bold" />
                  <Text style={styles.chipText}>{countdown.label}</Text>
                </View>
              )}
              {yourTurnChip && (
                <View style={[styles.chip, styles.chipSolid]}>
                  <ArrowBendUpLeft size={11} color={Brand.tagMintInk} weight="bold" />
                  <Text style={[styles.chipText, styles.chipTextSolid]}>Your turn</Text>
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
    </HardShadow>
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

// Swipe-action sizing. The revealed zone is one persistent ink panel (the
// hard-shadow black extended to full height); Pin / Pass / Mute / Archive are
// inset buttons sitting on that field. BTN_W is each button's width, PANEL_PAD
// the ink shown around and between them. The panel underlaps the card by
// PANEL_OVERLAP so the black reads as starting *behind* the card and sliding
// out from under it — no cream gutter between card and actions.
const BTN_W         = 72;
const PANEL_PAD     = 6;
const PANEL_OVERLAP = 32;

const styles = StyleSheet.create({
  // Spacing lives on the HardShadow wrapper so the offset edge hugs the card
  // (a margin on the card itself would expose the backing block below it).
  rowWrap: { marginBottom: 12 },
  // Cream island cards — aligned with the Projects look: cream fill, crisp
  // 1.5 ink border, hard offset edge from the <HardShadow> wrapper.
  card: {
    backgroundColor: Brand.cardCream,
    borderWidth: 1.5,
    borderColor: Brand.inkEdge,
    borderRadius: Radii.card,
    padding: 16,
    gap: 8,
  },
  // Pending rows share the island-card frame; the teal lives in the byline
  // and countdown chip rather than a tinted fill. Extra padding keeps the
  // "needs you" cards a touch more generous.
  cardPending: {
    padding: 20,
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
    gap: 12,
  },

  // Avatar — rounded square (Stitch direction), pale gray fill,
  // italic bronze monogram. 48pt with 12pt radius.
  avatarWrap: { width: AVATAR_SIZE, height: AVATAR_SIZE },
  avatar: { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: 12 },
  avatarFallback: {
    backgroundColor: Brand.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarClosed: {},
  avatarInitial: {
    fontFamily: AmbitFont.display,
    fontSize: 18,
    color: Brand.inkLabel,
    letterSpacing: -0.2,
  },
  byline: {
    marginTop: 2,
    fontFamily: AmbitFont.body,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.6,
    color: Brand.inkLabel,
  },
  bylinePending: { color: Brand.actionDeep },
  bylineClosed:  { color: Brand.inkMuted },
  bylineProject: { color: Brand.inkLabel },
  bylineSep:     { color: Brand.inkLabel },
  time: {
    fontFamily: AmbitFont.body,
    fontSize: 11,
    fontWeight: '600',
    color: Brand.inkMuted,
    letterSpacing: 0.04,
  },

  name: {
    fontFamily: AmbitFont.display,
    fontSize: 20,
    color: Brand.inkPrimary,
    letterSpacing: -0.3,
    lineHeight: 24,
  },
  nameClosed: { color: Brand.inkMuted },

  preview: {
    fontFamily: AmbitFont.body,
    fontSize: 14,
    color: Brand.inkBody,
    lineHeight: 19,
  },
  previewPending: {
    // Synthesized italic on Plus Jakarta — the pending preview reads
    // as a quoted line from the partner ("their voice"). When a real
    // serif italic ships we'll swap fontFamily here.
    fontStyle: 'italic',
    fontSize: 14,
  },
  previewClosed: { color: Brand.inkMuted },
  previewPrefix: { fontWeight: '700', color: Brand.inkPrimary },

  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  // Quiet chip family — pale neutral outline chip for the countdown,
  // mint solid for status (Hired / Your turn).
  chipOutline: {
    borderColor: Brand.borderSoft,
    backgroundColor: Brand.surface1,
  },
  chipSolid: {
    borderColor: 'transparent',
    backgroundColor: Brand.tagMint,
  },
  chipText: {
    fontFamily: AmbitFont.body,
    fontSize: 11,
    fontWeight: '700',
    color: Brand.inkLabel,
    letterSpacing: 0.02,
  },
  chipTextSolid: { color: Brand.tagMintInk },

  // Swipe actions: one persistent ink panel (the row's hard-shadow black grown
  // to full height) holding the buttons as inset sections. The panel underlaps
  // the card by PANEL_OVERLAP (negative margin) so the black appears to start
  // behind the card and slide out from under it — no cream gutter between them.
  actionOuter: { flexDirection: 'row', alignItems: 'stretch' },
  actionPanel: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: PANEL_PAD,
    paddingVertical: PANEL_PAD,
    backgroundColor: Brand.actionInk,
    borderRadius: Radii.card,
  },
  // Right reveal: black tucks under the card's right edge; buttons stay in the
  // visible zone via the overlap-sized left padding.
  actionPanelRight: { marginLeft: -PANEL_OVERLAP, paddingLeft: PANEL_PAD + PANEL_OVERLAP, paddingRight: PANEL_PAD },
  // Left reveal: mirror — black tucks under the card's left edge.
  actionPanelLeft:  { marginRight: -PANEL_OVERLAP, paddingRight: PANEL_PAD + PANEL_OVERLAP, paddingLeft: PANEL_PAD },
  actionBtn: {
    width: BTN_W,
    borderRadius: Radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  pinBtn:     { backgroundColor: Brand.accent },
  passBtn:    { backgroundColor: Brand.danger },
  muteBtn:    { backgroundColor: Brand.accent },
  archiveBtn: { backgroundColor: Brand.inkLabel },
  actionLabel: {
    fontFamily: AmbitFont.body,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: Brand.inkOnBrand,
  },

  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
