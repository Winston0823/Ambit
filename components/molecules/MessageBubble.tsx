import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Paperclip, Warning } from 'phosphor-react-native';
import { toast } from '../../lib/toast';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

/// Ids that have already played their entrance — so a message animates in
/// exactly once (a new/sent message), never again on FlatList scroll-recycle.
const animatedMsgIds = new Set<string>();

// Screen-anchored "gradient" layer revealed through my (outgoing) bubbles.
// Vocabulary-locked: outgoing bubbles are now a FLAT Brand.action fill, so
// the stops are identical — the LinearGradient plumbing stays (positioning
// math + clipping unchanged) but renders as one solid royal.
const MINE_GRADIENT = [Brand.action, Brand.action] as const; // flat royal (white text on top)
const MINE_GRADIENT_START = { x: 0.4, y: 0 };
const MINE_GRADIENT_END = { x: 0.6, y: 1 };
import type { MessageRow, ReactionRow } from '../../lib/messaging';
import { getCachedAttachmentUrl } from '../../lib/messaging';
import type { SchedulingRequestRow } from '../../lib/scheduling';
import { SchedulingBubble } from './SchedulingBubble';
import type { AvailabilityPollRow } from '../../lib/availability';
import { AvailabilityPollBubble } from './AvailabilityPollBubble';
import type { ProjectRefRow } from '../../lib/messaging';
import type { PortfolioItem } from '../../data/mock';
import { ProjectAttachmentBubble } from './ProjectAttachmentBubble';
import { PortfolioAttachmentBubble } from './PortfolioAttachmentBubble';
import { ContactCardBubble } from './ContactCardBubble';
import { Avatar } from '../atoms';
import { AmbitFont, Brand, Radii, Space } from '../../constants/theme';
import { Motion } from '../../constants/motion';

/// Send lifecycle for a locally-originated message — used to render the
/// in-flight spinner / failure marker on my-own bubbles. Partner bubbles
/// always render as 'sent'.
export type MessageStatus = 'sending' | 'sent' | 'failed';

interface Props {
  message:       MessageRow;
  /// Used to color and align the bubble (right=mine, left=partner).
  isMine:        boolean;
  /// Reactions on this message.
  reactions:     ReactionRow[];
  /// Map of partner-user-id → display name, used to label parent message
  /// previews and reaction counts. Includes self.
  nameById:      Record<string, string>;
  /// Parent message body for the inline reply quote, if any.
  parent?:       Pick<MessageRow, 'sender_id' | 'body' | 'attachment_url' | 'deleted_at'> | null;
  /// Last time the partner read the conversation. For my messages, used
  /// to decide between ✓ (sent) and ✓✓ (read).
  partnerLastReadAt: string | null;
  /// User id of the signed-in viewer.
  meId:          string;
  /// Optimistic-send state for my own messages. Defaults to 'sent' if the
  /// message has been confirmed by the server.
  status?:       MessageStatus;
  /// True when this is the most recent message from me — used to render
  /// the iMessage-style "Delivered" / "Read" line directly under the bubble.
  /// Earlier mine bubbles stay clean (no inline meta).
  isLatestMine?: boolean;
  /// Sender's monster mark (profiles.avatar_id) — the default identity
  /// visual next to the bubble. Rendered via the shared Avatar atom.
  avatarId?:     string | null;
  /// Revealed real photo of the sender, when the conversation is mutual
  /// (self is always revealed). Comes from the thread's fetchPeerPhotos
  /// map; absent = keep the monster mark. expo-image crossfades the swap.
  photoUrl?:     string | null;
  /// Display name of the sender (used for the accessibility label).
  senderName?:   string;
  /// Tap reaction chip → toggle off / on (caller routes to toggleReaction).
  onToggleReaction: (emoji: string) => void;
  /// Long press → action sheet (react / reply / copy / edit / delete).
  onLongPress:   () => void;
  /// Tap → retry a failed send. Only invoked when status === 'failed'.
  onRetry?:      () => void;
  /// When the message links to a scheduling_request, the parent provides
  /// the request row so the bubble can render the SchedulingBubble card
  /// in place of the normal body. Null while loading.
  schedulingRequest?: SchedulingRequestRow | null;
  /// When the message announces an availability poll, the parent
  /// provides the poll row so the bubble can render
  /// AvailabilityPollBubble. Tap on "Open" propagates up.
  availabilityPoll?: AvailabilityPollRow | null;
  onOpenAvailabilityPoll?: (pollId: string) => void;
  /// Opens the SchedulingComposer (propose flow). Surfaced by the poll
  /// bubble once both sides have marked times and overlap exists.
  onProposeMeetingTime?: () => void;
  /// When the message carries an attached project, the parent provides the
  /// project row so the bubble renders a tappable project card. Tap opens
  /// the preview (propagated up via onOpenProjectRef).
  projectRef?: ProjectRefRow | null;
  onOpenProjectRef?: (project: ProjectRefRow) => void;
  /// Resolved portfolio highlight for a portfolio_ref_id message; tapping the
  /// card opens the one-page preview (propagated via onOpenPortfolioRef).
  portfolioRef?: PortfolioItem | null;
  onOpenPortfolioRef?: (item: PortfolioItem) => void;
  /// Native-driven scroll offset of the message list + a plain ref mirror of
  /// its current value. Used by my own bubbles to keep their screen-anchored
  /// gradient pinned to the viewport as the list scrolls. Optional — when
  /// absent, mine bubbles just use their solid fallback fill.
  scrollY?:    Animated.Value;
  scrollYRef?: { current: number };
  /// Message grouping (consecutive messages from the same sender within a
  /// short window). `firstInGroup` controls top spacing; `lastInGroup` controls
  /// the avatar + the bubble's tail corner. Both default true → ungrouped.
  firstInGroup?: boolean;
  lastInGroup?:  boolean;
  /// When true (a message that arrived after the thread mounted), the bubble
  /// fades + rises in on the shared motion curve. Historical messages don't.
  animateIn?: boolean;
}

/// Resolve a path into a renderable URL. Local URIs (file://) pass through
/// untouched — used by the optimistic image path so the picked image
/// renders instantly while the upload is in flight. Storage paths route
/// through `getCachedAttachmentUrl` which memoizes signed URLs.
function useAttachmentUrl(path: string | null): string | null {
  const [url, setUrl] = useState<string | null>(
    // Synchronously return local URIs so the image is visible on first render.
    path && (path.startsWith('file://') || path.startsWith('content://')) ? path : null,
  );
  useEffect(() => {
    if (!path) {
      setUrl(null);
      return;
    }
    if (path.startsWith('file://') || path.startsWith('content://')) {
      setUrl(path);
      return;
    }
    let cancelled = false;
    getCachedAttachmentUrl(path).then((u) => {
      if (!cancelled) setUrl(u);
    });
    return () => {
      cancelled = true;
    };
  }, [path]);
  return url;
}

/// Splits a run of text on http(s):// and www.-prefixed tokens and
/// renders the URL tokens as tappable, underlined spans. Kept simple on
/// purpose (regex split, no full URL grammar) — the goal is "links you
/// can tap," not a parser. Trailing sentence punctuation is trimmed off
/// the tap target so "see https://ambit.app." doesn't open a URL with a
/// dangling period.
const URL_SPLIT_RE = /((?:https?:\/\/|www\.)[^\s]+)/gi;

function openUrl(raw: string) {
  // Strip trailing punctuation that's almost certainly sentence-level.
  const cleaned = raw.replace(/[.,;:!?)\]]+$/, '');
  const href = /^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`;
  Linking.openURL(href).catch(() => {
    toast.error("Couldn't open that link.");
  });
}

function LinkifiedText({ text, style, linkStyle }: { text: string; style: any; linkStyle?: any }) {
  // Reset lastIndex isn't needed with String.split, and split keeps the
  // captured delimiters (the URLs) as odd-indexed array entries.
  const parts = text.split(URL_SPLIT_RE);
  return (
    <Text style={style}>
      {parts.map((part, i) => {
        if (i % 2 === 1) {
          return (
            <Text
              key={i}
              style={[styles.link, linkStyle]}
              onPress={() => openUrl(part)}
              suppressHighlighting
            >
              {part}
            </Text>
          );
        }
        return part;
      })}
    </Text>
  );
}

export function MessageBubble({
  message,
  isMine,
  reactions,
  nameById,
  parent,
  partnerLastReadAt,
  meId,
  status = 'sent',
  avatarId,
  photoUrl,
  senderName,
  isLatestMine = false,
  onToggleReaction,
  onLongPress,
  onRetry,
  schedulingRequest,
  availabilityPoll,
  onOpenAvailabilityPoll,
  onProposeMeetingTime,
  projectRef,
  onOpenProjectRef,
  portfolioRef,
  onOpenPortfolioRef,
  scrollY,
  scrollYRef,
  firstInGroup = true,
  lastInGroup = true,
  animateIn = false,
}: Props) {
  // Entrance: fade + rise, once per id (new/sent messages only).
  const shouldAnimate = animateIn && !animatedMsgIds.has(message.id);
  const entrance = useRef(new Animated.Value(shouldAnimate ? 0 : 1)).current;
  useEffect(() => {
    if (shouldAnimate) {
      animatedMsgIds.add(message.id);
      Animated.timing(entrance, { toValue: 1, duration: 280, easing: Motion.easeOutExpo, useNativeDriver: true }).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const entranceY = entrance.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });

  const attachmentUrl = useAttachmentUrl(message.attachment_url);
  const isDeleted = !!message.deleted_at;

  // Screen-anchored gradient bookkeeping (mine bubbles only). We measure the
  // bubble's window position once it lays out and store its content-space top
  // (window-y + scroll-at-measure) + its left x. translateY = scrollY - anchorY
  // and translateX = -anchorX then keep the screen-sized gradient pinned to
  // the viewport while the bubble clips it.
  const bubbleRef = useRef<View>(null);
  const [gradAnchor, setGradAnchor] = useState<{ x: number; y: number } | null>(null);
  const measureBubble = useCallback(() => {
    if (!isMine || !scrollY) return;
    bubbleRef.current?.measureInWindow((x, y) => {
      if (Number.isFinite(x) && Number.isFinite(y)) {
        setGradAnchor({ x, y: y + (scrollYRef?.current ?? 0) });
      }
    });
  }, [isMine, scrollY, scrollYRef]);
  const wasEdited = !!message.edited_at && !isDeleted;
  const kind = message.kind ?? 'user';

  // Shared send-status row for the attachment branches (scheduling / poll
  // / project / portfolio) that early-return before the default bubble's
  // status row. Without this, an optimistic attachment send that fails is
  // completely silent — no spinner, no "tap to retry" (audit fix). Only
  // renders while a send is actually in flight or failed; a sent card
  // stays clean. Tapping the failed row retries where a payload exists.
  const sendStatusRow =
    isMine && (status === 'sending' || status === 'failed') ? (
      <View style={styles.statusRow}>
        {status === 'sending' ? (
          <>
            <ActivityIndicator size="small" color={Brand.inkMuted} />
            <Text style={styles.statusText}>Sending…</Text>
          </>
        ) : (
          <Pressable
            onPress={onRetry}
            hitSlop={6}
            style={styles.statusRetry}
            accessibilityRole="button"
            accessibilityLabel="Retry failed send"
          >
            <Warning size={11} color={Brand.danger} weight="fill" />
            <Text style={[styles.statusText, { color: Brand.danger }]}>
              Not delivered · Tap to retry
            </Text>
          </Pressable>
        )}
      </View>
    ) : null;

  // System messages (closure-loop) render as a centered banner pill
  // rather than a speech bubble. Reactions / read receipts / replies
  // don't apply to them.
  if (kind !== 'user') {
    return (
      <View style={styles.systemRow}>
        <View style={[styles.systemPill, kindToPillStyle(kind)]}>
          <Text style={styles.systemText}>
            {systemPrefix(kind, nameById[message.sender_id])}
            {message.body ? `: ${message.body}` : ''}
          </Text>
        </View>
      </View>
    );
  }

  // Scheduling messages bypass the regular bubble chrome — the
  // SchedulingBubble card is its own self-contained surface.
  if (message.scheduling_request_id && schedulingRequest && !isDeleted) {
    return (
      <View style={[styles.row, isMine ? styles.rowMine : styles.rowTheirs]}>
        <SchedulingBubble
          request={schedulingRequest}
          meId={meId}
          isMine={isMine}
        />
        {sendStatusRow}
      </View>
    );
  }

  // Availability poll messages — same idea as scheduling.
  if (message.availability_poll_id && availabilityPoll && !isDeleted) {
    return (
      <View style={[styles.row, isMine ? styles.rowMine : styles.rowTheirs]}>
        <AvailabilityPollBubble
          poll={availabilityPoll}
          isMine={isMine}
          meId={meId}
          onOpen={() => onOpenAvailabilityPoll?.(availabilityPoll.id)}
          onProposeTime={() => onProposeMeetingTime?.()}
        />
        {sendStatusRow}
      </View>
    );
  }

  // Project attachment — tappable project card in place of the body text.
  if (message.project_ref_id && projectRef && !isDeleted) {
    return (
      <View style={[styles.row, isMine ? styles.rowMine : styles.rowTheirs]}>
        <ProjectAttachmentBubble
          project={projectRef}
          isMine={isMine}
          onPress={() => onOpenProjectRef?.(projectRef)}
        />
        {sendStatusRow}
      </View>
    );
  }

  // Portfolio-highlight attachment — tappable highlight card.
  if (message.portfolio_ref_id && portfolioRef && !isDeleted) {
    return (
      <View style={[styles.row, isMine ? styles.rowMine : styles.rowTheirs]}>
        <PortfolioAttachmentBubble
          item={portfolioRef}
          isMine={isMine}
          onPress={() => onOpenPortfolioRef?.(portfolioRef)}
        />
        {sendStatusRow}
      </View>
    );
  }

  // Contact-info card — the sender's shared contact details.
  if (message.contact_card && !isDeleted) {
    return (
      <View style={[styles.row, isMine ? styles.rowMine : styles.rowTheirs]}>
        <ContactCardBubble card={message.contact_card} isMine={isMine} />
        {sendStatusRow}
      </View>
    );
  }

  const readByPartner =
    isMine &&
    partnerLastReadAt !== null &&
    new Date(message.created_at).getTime() <= new Date(partnerLastReadAt).getTime();

  // Group reactions by emoji for the compact pill row.
  const groupedReactions = reactions.reduce<Record<string, ReactionRow[]>>((acc, r) => {
    (acc[r.emoji] ??= []).push(r);
    return acc;
  }, {});

  return (
    <Animated.View
      style={[
        styles.row,
        isMine ? styles.rowMine : styles.rowTheirs,
        !firstInGroup && styles.rowGrouped,
        { opacity: entrance, transform: [{ translateY: entranceY }] },
      ]}
    >
      {/* Inner row aligns the avatar to the bubble's bottom edge —
          iMessage pattern. Partner avatar on the LEFT (outside-of-
          screen-edge side), mine on the RIGHT for the mirror. The avatar
          shows only on the LAST bubble of a run; earlier bubbles keep a
          spacer so the column stays aligned. */}
      <View style={styles.bubbleRow}>
        {!isMine && (lastInGroup ? <Avatar avatarId={avatarId} photoUrl={photoUrl} size={32} /> : <View style={styles.avatarSpacer} />)}
        <Pressable
          ref={bubbleRef}
          onLayout={measureBubble}
          onLongPress={isDeleted ? undefined : onLongPress}
          onPress={isMine && status === 'failed' ? onRetry : undefined}
          delayLongPress={250}
          // VoiceOver: the message actions (react/reply/copy/edit/delete) are
          // only reachable via long-press, which screen-reader users can't
          // perform. Expose them through the actions rotor instead, plus a
          // Retry action for a failed send.
          accessibilityRole="button"
          accessibilityLabel={`${isMine ? 'You' : senderName || 'They'} said: ${
            isDeleted ? 'message deleted' : message.body?.trim() || 'attachment'
          }`}
          accessibilityHint={isDeleted ? undefined : 'Opens message options'}
          accessibilityActions={[
            ...(isDeleted ? [] : [{ name: 'options', label: 'Message options' }]),
            ...(isMine && status === 'failed' ? [{ name: 'retry', label: 'Retry sending' }] : []),
          ]}
          onAccessibilityAction={(e) => {
            const action = e.nativeEvent.actionName;
            if (action === 'options' && !isDeleted) onLongPress();
            else if (action === 'retry') onRetry?.();
          }}
          style={[
            styles.bubble,
            isMine ? styles.bubbleMine : styles.bubbleTheirs,
            // Tail corner only on the last bubble of a run; otherwise round it.
            !lastInGroup && (isMine ? styles.bubbleMineGrouped : styles.bubbleTheirsGrouped),
            isDeleted && styles.bubbleDeleted,
            isMine && status === 'sending' && styles.bubblePending,
            isMine && status === 'failed' && styles.bubbleFailed,
          ]}
        >
        {/* Screen-anchored gradient: the bubble (overflow:hidden) clips this
            screen-sized gradient; translateX/Y keep it pinned to the viewport
            as the list scrolls, so the bubble reveals the slice it sits over. */}
        {isMine && scrollY && gradAnchor && !isDeleted && status !== 'failed' && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.mineGradientLayer,
              {
                transform: [
                  { translateX: -gradAnchor.x },
                  { translateY: Animated.subtract(scrollY, gradAnchor.y) },
                ],
              },
            ]}
          >
            <LinearGradient
              colors={MINE_GRADIENT}
              start={MINE_GRADIENT_START}
              end={MINE_GRADIENT_END}
              style={styles.mineGradientFill}
            />
          </Animated.View>
        )}
        {/* Reply preview — small bar above the body that quotes the parent.
            For attachment-only parents, an inline Paperclip + "Photo" label
            stands in for the body. */}
        {parent && (
          <View style={[styles.replyQuote, isMine && styles.replyQuoteMine]}>
            <Text
              style={[styles.replyAuthor, isMine && styles.replyAuthorMine]}
              numberOfLines={1}
            >
              {nameById[parent.sender_id] ?? 'Unknown'}
            </Text>
            {parent.deleted_at ? (
              <Text
                style={[styles.replyBody, isMine && styles.replyBodyMine]}
                numberOfLines={2}
              >
                Message deleted
              </Text>
            ) : parent.body ? (
              <Text
                style={[styles.replyBody, isMine && styles.replyBodyMine]}
                numberOfLines={2}
              >
                {parent.body}
              </Text>
            ) : parent.attachment_url ? (
              <View style={styles.replyBodyRow}>
                <Paperclip
                  size={12}
                  color={isMine ? Brand.actionInk : Brand.inkMuted}
                  weight="regular"
                />
                <Text style={[styles.replyBody, isMine && styles.replyBodyMine]}>
                  Photo
                </Text>
              </View>
            ) : null}
          </View>
        )}

        {/* Image attachment. */}
        {attachmentUrl && !isDeleted && (
          <Image source={{ uri: attachmentUrl }} style={styles.image} contentFit="cover" cachePolicy="memory-disk" transition={180} />
        )}

        {/* Body. iMessage parity: no inline timestamp / checkmark — the
            bubble is just the text. Status, read state, and edited badge
            ride on a small external row under the bubble (see below). */}
        {isDeleted ? (
          <Text style={[styles.tombstone, isMine && styles.tombstoneMine]}>
            Message deleted
          </Text>
        ) : message.body ? (
          <LinkifiedText
            text={message.body}
            style={[
              styles.body,
              isMine && styles.bodyMine,
              // Failed sends flip the bubble to the danger fill; dark ink on
              // that red is ~2.9:1. White ink restores contrast.
              isMine && status === 'failed' && styles.bodyFailed,
            ]}
            // Links on the royal "mine" fill need a light color too — the
            // default deep-royal link would vanish into the bubble.
            linkStyle={isMine ? styles.linkMine : undefined}
          />
        ) : null}
      </Pressable>
        {isMine && (lastInGroup ? <Avatar avatarId={avatarId} photoUrl={photoUrl} size={32} /> : <View style={styles.avatarSpacer} />)}
      </View>

      {/* External status line — iMessage style. Only renders for the latest
          mine bubble (Read / Delivered), or whenever a non-sent state needs
          to surface (sending spinner / failed / edited). Earlier mine and
          partner bubbles stay clean to keep the thread tight. */}
      {isMine && !isDeleted && (isLatestMine || status !== 'sent' || wasEdited) && (
        <View style={styles.statusRow}>
          {status === 'sending' ? (
            <>
              <ActivityIndicator size="small" color={Brand.inkMuted} />
              <Text style={styles.statusText}>Sending…</Text>
            </>
          ) : status === 'failed' ? (
            <>
              <Warning size={11} color={Brand.danger} weight="fill" />
              <Text style={[styles.statusText, { color: Brand.danger }]}>
                Not delivered · Tap to retry
              </Text>
            </>
          ) : (
            <>
              {wasEdited && (
                <Text style={[styles.statusText, { fontStyle: 'italic' }]}>
                  edited ·
                </Text>
              )}
              <Text style={styles.statusText}>
                {readByPartner ? 'Read' : 'Delivered'} {formatTime(message.created_at)}
              </Text>
            </>
          )}
        </View>
      )}

      {/* Reactions row sits under the bubble, on the same side. */}
      {Object.keys(groupedReactions).length > 0 && (
        <View style={[styles.reactionRow, isMine ? styles.reactionRowMine : styles.reactionRowTheirs]}>
          {Object.entries(groupedReactions).map(([emoji, rows]) => {
            const iReacted = rows.some((r) => r.user_id === meId);
            return (
              <Pressable
                key={emoji}
                onPress={() => onToggleReaction(emoji)}
                style={[styles.reactionChip, iReacted && styles.reactionChipMine]}
              >
                <Text style={styles.reactionEmoji}>{emoji}</Text>
                {rows.length > 1 && (
                  <Text style={styles.reactionCount}>{rows.length}</Text>
                )}
              </Pressable>
            );
          })}
        </View>
      )}
    </Animated.View>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const am = h < 12;
  h = h % 12; if (h === 0) h = 12;
  return `${h}:${m} ${am ? 'AM' : 'PM'}`;
}

/// Friendly prefix for system-message rendering. We swap the sender's
/// name (or "They") in to anchor whose action triggered the banner.
function systemPrefix(kind: NonNullable<MessageRow['kind']>, senderDisplayName?: string): string {
  const who = senderDisplayName ?? 'They';
  switch (kind) {
    case 'system_pass':            return `${who} passed`;
    // Neutral, role-agnostic: the proposer can be either party (owner-receiver
    // "makes an offer" or seeker-receiver "accepts"), and the bubble doesn't
    // know roles — so avoid the founder-voiced phrasing.
    case 'system_hire_proposed':   return `${who} proposed making it official`;
    case 'system_hired':           return `It's a match — hired!`;
    case 'system_auto_declined':   return `This reach-out expired without a reply.`;
    case 'user':
    default:                       return '';
  }
}

function kindToPillStyle(kind: NonNullable<MessageRow['kind']>) {
  switch (kind) {
    case 'system_hired':
    case 'system_hire_proposed':
      return styles.systemPillWarm;
    case 'system_pass':
    case 'system_auto_declined':
      return styles.systemPillMuted;
    case 'user':
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: Space.md,
    marginVertical: 3,
  },
  // Grouped (same sender, back-to-back): tuck closer so a run reads as one voice.
  rowGrouped: { marginTop: 0 },
  rowMine:   { alignItems: 'flex-end' },
  rowTheirs: { alignItems: 'flex-start' },
  // Keeps the bubble column aligned when the avatar is hidden mid-run.
  avatarSpacer: { width: 32 },

  // Inner row that pairs the avatar with the bubble. alignItems:flex-end
  // anchors the avatar to the bubble's bottom edge regardless of how
  // tall the bubble grows (multi-line text, attached image, etc.).
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },

  // System-message banner (closure-loop events). Centered, narrow, muted.
  systemRow: {
    paddingHorizontal: Space.lg,
    marginVertical: 12,
    alignItems: 'center',
  },
  systemPill: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    maxWidth: '85%',
    borderWidth: 1,
    borderColor: Brand.borderSoft,
  },
  systemPillMuted: { backgroundColor: Brand.cardCream },
  systemPillWarm:  { backgroundColor: Brand.tagMint },
  systemText: {
    fontFamily: AmbitFont.semibold,
    fontSize: 13,
    color: Brand.inkBody,
    textAlign: 'center',
  },

  bubble: {
    // iMessage rhythm — tight padding, no shadow, no internal meta row.
    maxWidth: '72%',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
    overflow: 'hidden',
  },
  bubbleMine: {
    // Flat royal fill, white text — the signature ASTRA outgoing bubble.
    // Tight tail corner (bottom-right 5) anchors it to my side.
    backgroundColor: Brand.action,
    borderBottomRightRadius: 5,
  },
  // Screen-sized gradient layer clipped by the bubble's rounded rect.
  mineGradientLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SCREEN_W,
    height: SCREEN_H,
  },
  mineGradientFill: {
    width: SCREEN_W,
    height: SCREEN_H,
  },
  bubbleTheirs: {
    // Incoming surface — white/glass island with only a soft hairline for
    // separation. Tail corner bottom-left 5 anchors it to their side.
    backgroundColor: Brand.cardCream,
    borderBottomLeftRadius: 5,
    borderWidth: 1,
    borderColor: Brand.borderSoft,
  },
  // Mid-run bubbles round their tail corner (the tail belongs to the last one).
  bubbleTheirsGrouped: { borderBottomLeftRadius: 16 },
  bubbleMineGrouped:   { borderBottomRightRadius: 16 },
  bubbleDeleted: { opacity: 0.65 },
  // Optimistic-send tints: while in flight the bubble is slightly
  // translucent; on failure it shifts to a muted red so the user sees the
  // tap-to-retry affordance without breaking the brand palette completely.
  bubblePending: { opacity: 0.7 },
  bubbleFailed:  { backgroundColor: Brand.danger },

  body: {
    fontFamily: AmbitFont.body,
    fontSize: 16,
    color: Brand.inkBody,
    lineHeight: 21,
  },
  bodyMine: { color: Brand.inkOnBrand }, // white on the royal fill (was dark ink — invisible)
  bodyFailed: { color: Brand.inkOnBrand },
  // Tappable URL span — underline + brand accent so it reads as a link
  // without leaving the type ramp.
  linkMine: { color: '#FFFFFF' },
  link: {
    color: Brand.actionDeep,
    textDecorationLine: 'underline',
  },

  // External status line below the latest mine bubble — iMessage
  // "Delivered" / "Read 3:36 PM". Tiny, right-aligned, muted.
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 4,
    marginTop: 2,
    paddingRight: 40, // align with bubble edge, past the avatar gutter
  },
  statusText: {
    fontFamily: AmbitFont.body,
    fontSize: 11,
    color: Brand.inkMuted,
    letterSpacing: 0.1,
  },
  // Tappable retry affordance inside the attachment-branch status row.
  statusRetry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  tombstone: {
    fontFamily: AmbitFont.body,
    fontSize: 14,
    fontStyle: 'italic',
    color: Brand.inkMuted,
  },
  tombstoneMine: { color: 'rgba(255,255,255,0.72)' },

  image: {
    width: 220,
    height: 220,
    borderRadius: Radii.md,
    backgroundColor: Brand.surface2,
  },

  replyQuote: {
    borderLeftWidth: 3,
    borderLeftColor: Brand.accent,
    paddingLeft: 8,
    paddingVertical: 2,
    marginBottom: 2,
  },
  replyQuoteMine: { borderLeftColor: Brand.canvas },
  replyAuthor: {
    fontFamily: AmbitFont.semibold,
    fontSize: 11,
    color: Brand.accent,
  },
  replyAuthorMine: { color: Brand.canvas },
  replyBody: {
    fontFamily: AmbitFont.body,
    fontSize: 12,
    color: Brand.inkMuted,
  },
  replyBodyMine: { color: 'rgba(255,255,255,0.85)' },
  replyBodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  reactionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
    maxWidth: '70%',
  },
  reactionRowMine:   { justifyContent: 'flex-end' },
  reactionRowTheirs: { justifyContent: 'flex-start' },
  reactionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Brand.surface2,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  reactionChipMine: {
    backgroundColor: Brand.seekerSurface,
    borderColor: Brand.accent,
  },
  reactionEmoji: {
    fontSize: 13,
  },
  reactionCount: {
    fontFamily: AmbitFont.body,
    fontSize: 11,
    color: Brand.inkLabel,
  },
});
