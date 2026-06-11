import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Paperclip, Warning } from 'phosphor-react-native';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

/// Ids that have already played their entrance — so a message animates in
/// exactly once (a new/sent message), never again on FlatList scroll-recycle.
const animatedMsgIds = new Set<string>();

// Screen-anchored "gradient" layer revealed through my (outgoing) bubbles.
// Vocabulary-locked: outgoing bubbles are now a FLAT Brand.action fill, so
// the stops are identical — the LinearGradient plumbing stays (positioning
// math + clipping unchanged) but renders as one solid teal.
const MINE_GRADIENT = [Brand.action, Brand.action] as const; // flat teal (dark ink text on top)
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
  /// Avatar URL of the message sender. Rounded-square thumbnail rendered
  /// next to the bubble (left for partner, right for mine). Null falls
  /// back to a colored initial.
  avatarUrl?:    string | null;
  /// Display name of the sender (used for the initial-fallback avatar).
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

/// Rounded-square avatar rendered next to each bubble. 32pt with 8pt
/// radius (App-Store-icon vibe). Falls back to the sender's first
/// initial on a muted surface when no photo is available, and also
/// when the remote image fails to load.
function Avatar({
  url,
  name,
}: {
  url?: string | null;
  name?: string;
}) {
  const [failed, setFailed] = useState(false);
  const initial = (name ?? '?').trim().slice(0, 1).toUpperCase() || '?';
  const showImage = !!url && !failed;
  return (
    <View style={styles.avatar}>
      {showImage ? (
        <Image
          source={{ uri: url! }}
          style={styles.avatarImg}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <Text style={styles.avatarInitial}>{initial}</Text>
      )}
    </View>
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
  avatarUrl,
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
        {!isMine && (lastInGroup ? <Avatar url={avatarUrl} name={senderName} /> : <View style={styles.avatarSpacer} />)}
        <Pressable
          ref={bubbleRef}
          onLayout={measureBubble}
          onLongPress={isDeleted ? undefined : onLongPress}
          onPress={isMine && status === 'failed' ? onRetry : undefined}
          delayLongPress={250}
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
          <Image source={{ uri: attachmentUrl }} style={styles.image} resizeMode="cover" />
        )}

        {/* Body. iMessage parity: no inline timestamp / checkmark — the
            bubble is just the text. Status, read state, and edited badge
            ride on a small external row under the bubble (see below). */}
        {isDeleted ? (
          <Text style={[styles.tombstone, isMine && styles.tombstoneMine]}>
            Message deleted
          </Text>
        ) : message.body ? (
          <Text style={[styles.body, isMine && styles.bodyMine]}>{message.body}</Text>
        ) : null}
      </Pressable>
        {isMine && (lastInGroup ? <Avatar url={avatarUrl} name={senderName} /> : <View style={styles.avatarSpacer} />)}
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
    case 'system_hire_proposed':   return `${who} proposed marking this as Hired`;
    case 'system_hired':           return `It's a match — hired!`;
    case 'system_auto_declined':   return `${who} is reviewing other candidates`;
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

  // Rounded-square avatar. 32pt with 8pt radius — App-Store-icon shape,
  // distinct from the circular hero avatars elsewhere in the app.
  // On a white chat surface the avatar is a quiet neutral chip so it
  // doesn't compete with the colored bubbles — the visual emphasis
  // belongs on the conversation, not the affordance.
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Brand.surface1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarInitial: {
    fontFamily: AmbitFont.body,
    fontSize: 14,
    fontWeight: '700',
    color: Brand.inkLabel,
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
    fontFamily: AmbitFont.body,
    fontSize: 13,
    fontWeight: '600',
    color: Brand.inkBody,
    textAlign: 'center',
  },

  bubble: {
    // iMessage rhythm — tight padding, no shadow, no internal meta row.
    maxWidth: '72%',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
    overflow: 'hidden',
  },
  bubbleMine: {
    // Flat teal fill, borderless — the hard ink border is reserved for
    // tactile (pressable) surfaces; plain text bubbles stay quiet.
    backgroundColor: Brand.action,
    borderBottomRightRadius: 4,
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
    // Incoming surface — cream on eggshell with only a soft hairline for
    // separation; hard ink borders are reserved for interactive bubbles.
    backgroundColor: Brand.cardCream,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: Brand.borderSoft,
  },
  // Mid-run bubbles round their tail corner (the tail belongs to the last one).
  bubbleTheirsGrouped: { borderBottomLeftRadius: 20 },
  bubbleMineGrouped:   { borderBottomRightRadius: 20 },
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
  bodyMine: { color: Brand.actionInk },

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

  tombstone: {
    fontFamily: AmbitFont.body,
    fontSize: 14,
    fontStyle: 'italic',
    color: Brand.inkMuted,
  },
  tombstoneMine: { color: Brand.actionInk },

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
    fontFamily: AmbitFont.body,
    fontSize: 11,
    fontWeight: '600',
    color: Brand.accent,
  },
  replyAuthorMine: { color: Brand.canvas },
  replyBody: {
    fontFamily: AmbitFont.body,
    fontSize: 12,
    color: Brand.inkMuted,
  },
  replyBodyMine: { color: Brand.actionInk },
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
