import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Archive, ArrowBendUpLeft, Bell, BellSlash, Clock, PushPin, X } from 'phosphor-react-native';
import type { InboxItem } from '../../lib/messaging';
import { inboxState, isReachedOutToYou } from '../../lib/messaging';
import { getAutoCloseCountdown } from '../../lib/closureLoop';
import { AmbitFont, Astra, Brand, Radii } from '../../constants/theme';

/// Soft iris tint for rows that need you (unread / reached-out-to-you).
const SURFACE_NEEDS = 'rgba(153, 117, 206, 0.09)';

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
  // Unread: incoming messages I haven't read. Drives the row highlight, so
  // opening the chat (which marks it read) clears it — even for a reach-out
  // (pending) row, whose "your turn" state instead lives in the countdown chip.
  const isUnread  = (item.unread_count ?? 0) > 0 && !isClosed;
  const passable  = item.status === 'active' && !!onPassRequest;
  const canPin    = !!onPin;
  const isPinned  = !!item.is_pinned;
  // "Your turn" on active, non-pending rows where they sent last (pending rows
  // already signal it via the countdown chip, so we don't double up).
  const yourTurnChip =
    !isPending && !isClosed && item.status === 'active' && inboxState(item, meId) === 'your_turn';
  // Sender-side: I reached out and it's on THEM. The same 72h clock is
  // ticking against the conversation, so surface a quiet "expires in Xh"
  // so the sender knows silence has a deadline (audit fix, 2026-07-01).
  const isAwaiting = item.status === 'active' && sentByMe && !isPending;

  // Countdown ticks the label once a minute while the clock matters
  // (pending on my side OR awaiting their reply). Cheap timer; only the
  // label string updates so the rest of the tree doesn't re-render.
  const showTimer = isPending || isAwaiting;
  const [nowTick, setNowTick] = useState(0);
  useEffect(() => {
    if (!showTimer) return;
    const t = setInterval(() => setNowTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, [showTimer]);
  const countdown = useMemo(
    () => (showTimer ? getAutoCloseCountdown(item.auto_decline_at) : null),
    // nowTick is intentionally a dep — re-read at minute boundaries.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showTimer, item.auto_decline_at, nowTick],
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

  // Subtitle: project title, plus a status suffix where relevant. Mixed case,
  // iris — matches the Figma "Founder · Muse AI" byline.
  const bylineProject = item.project_title ?? '';
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

  // Row highlight (iris tint + dot) tracks UNREAD only, so it clears when you
  // open the chat. The reach-out "your turn" signal is the persistent countdown
  // chip below (driven by isPending), not a full-row highlight.
  const needsYou = isUnread;
  const subtitle = [bylineProject, bylineSuffix].filter(Boolean).join('  ·  ');
  const surfaceBg = needsYou ? SURFACE_NEEDS : Brand.cardCream;

  return (
    // Soft-shadow surface lives on the wrapper (outside the Swipeable, which
    // clips its own bounds). The card inside carries the same fill so the swipe
    // reveal stays seamless.
    <View style={[styles.rowWrap, { backgroundColor: surfaceBg }, isClosed && styles.rowClosed]}>
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
          { backgroundColor: surfaceBg },
          pressed && { opacity: 0.75 },
        ]}
      >
        {/* Avatar — 46pt gradient monogram (or partner photo). */}
        {item.partner_photo_url ? (
          <Image source={{ uri: item.partner_photo_url }} style={styles.avatar} cachePolicy="memory-disk" transition={180} />
        ) : (
          <LinearGradient
            colors={[Astra.royal, Astra.iris]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.avatar}
          >
            <Text style={styles.avatarInitial}>{initial}</Text>
          </LinearGradient>
        )}

        <View style={styles.col}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, isClosed && styles.nameClosed]} numberOfLines={1}>
              {item.partner_name ?? 'Someone'}
            </Text>
            <View style={styles.timeRow}>
              {item.is_muted && <BellSlash size={12} color={Brand.inkMuted} weight="bold" />}
              <Text style={[styles.time, needsYou && styles.timeAccent]}>
                {formatRelative(item.last_message_at)}
              </Text>
              {needsYou && <View style={styles.dot} />}
            </View>
          </View>

          {subtitle !== '' && (
            <Text style={[styles.subtitle, isClosed && styles.subtitleClosed]} numberOfLines={1}>
              {subtitle}
            </Text>
          )}

          <Text
            style={[styles.preview, isPending && styles.previewPending, isClosed && styles.previewClosed]}
            numberOfLines={1}
          >
            {previewPrefix && <Text style={styles.previewPrefix}>{previewPrefix}</Text>}
            {previewText}
          </Text>

          {(countdown || showHiredChip || yourTurnChip) && (
            <View style={styles.chipRow}>
              {countdown && isPending && (
                <View style={[styles.chip, countdown.urgent ? styles.chipUrgent : styles.chipOutline]}>
                  <Clock
                    size={11}
                    color={countdown.urgent ? Brand.inkOnBrand : Brand.inkLabel}
                    weight="bold"
                  />
                  <Text style={[styles.chipText, countdown.urgent && styles.chipTextUrgent]}>
                    {countdown.label}
                  </Text>
                </View>
              )}
              {countdown && isAwaiting && (
                <View style={[styles.chip, styles.chipOutline]}>
                  <Clock size={11} color={Brand.inkMuted} weight="regular" />
                  <Text style={[styles.chipText, styles.chipTextMuted]}>
                    {awaitingExpiryLabel(countdown.minutesLeft)}
                  </Text>
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
    </View>
  );
}

/// Sender-side expiry phrasing — mirrors the recipient's countdown but
/// framed from the waiting side: "expires in 21h" / "expires in 2d".
function awaitingExpiryLabel(minutesLeft: number): string {
  if (minutesLeft >= 24 * 60) {
    const days = Math.floor(minutesLeft / (24 * 60));
    return `expires in ${days}d`;
  }
  if (minutesLeft >= 60) return `expires in ${Math.floor(minutesLeft / 60)}h`;
  return `expires in ${minutesLeft}m`;
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

// Swipe-action sizing. The revealed zone is one persistent ink panel; Pin /
// Pass / Mute / Archive are inset buttons on that field. BTN_W is each button's
// width, PANEL_PAD the ink around/between them; the panel underlaps the card by
// PANEL_OVERLAP so the black reads as starting behind the card.
const BTN_W         = 72;
const PANEL_PAD     = 6;
const PANEL_OVERLAP = 32;

const styles = StyleSheet.create({
  // Soft-filled card (Figma chat list): rounded, gentle drop shadow, no border.
  // The wrapper carries the shadow (the Swipeable clips its own bounds) and a
  // fill matching the card so the swipe reveal stays seamless.
  rowWrap: {
    marginBottom: 10,
    borderRadius: Radii.card,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  rowClosed: { opacity: 0.55 },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderRadius: Radii.card,
    paddingLeft: 13,
    paddingRight: 14,
    paddingVertical: 13,
  },

  // Avatar — 46pt rounded-square gradient monogram (royal→iris), white serif
  // initial; a partner photo fills the same frame.
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarInitial: {
    fontFamily: AmbitFont.display,
    fontSize: 17,
    color: '#FFFFFF',
  },

  col: { flex: 1, minWidth: 0, gap: 3 },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  name: {
    flexShrink: 1,
    fontFamily: AmbitFont.semibold,
    fontSize: 15,
    color: Brand.inkPrimary,
  },
  nameClosed: { color: Brand.inkMuted },

  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  time: {
    fontFamily: AmbitFont.medium,
    fontSize: 11,
    color: Brand.inkMuted,
  },
  timeAccent: { color: Brand.selected },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Brand.selected },

  subtitle: {
    fontFamily: AmbitFont.medium,
    fontSize: 12,
    color: Brand.accent, // iris
  },
  subtitleClosed: { color: Brand.inkMuted },

  preview: {
    fontFamily: AmbitFont.medium,
    fontSize: 13,
    color: Brand.inkBody,
    lineHeight: 18,
  },
  previewPending: { fontStyle: 'italic' },
  previewClosed: { color: Brand.inkMuted },
  previewPrefix: { fontFamily: AmbitFont.semibold, color: Brand.inkPrimary },

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
  // Urgent tier (< 24h): solid danger fill, white ink — the countdown
  // stops being a quiet outline and reads as a real deadline. Still on
  // brand (uses the palette's `danger` + `inkOnBrand`).
  chipUrgent: {
    borderColor: 'transparent',
    backgroundColor: Brand.danger,
  },
  chipText: {
    fontFamily: AmbitFont.bold,
    fontSize: 11,
    color: Brand.inkLabel,
    letterSpacing: 0.02,
  },
  chipTextSolid: { color: Brand.tagMintInk },
  chipTextUrgent: { color: Brand.inkOnBrand },
  chipTextMuted: { color: Brand.inkMuted, fontFamily: AmbitFont.semibold },

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
    fontFamily: AmbitFont.bold,
    fontSize: 11,
    letterSpacing: 0.5,
    color: Brand.inkOnBrand,
  },
});
