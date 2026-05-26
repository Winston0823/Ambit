import React, { useRef } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Paperclip, X } from 'phosphor-react-native';
import type { InboxItem } from '../../lib/messaging';
import { AmbitFont, Brand, Radii, Space } from '../../constants/theme';

interface Props {
  item:      InboxItem;
  meId:      string;
  onPress:   () => void;
  /// Fired when the user swipes the row left and taps Pass. Parent owns
  /// the PassReasonSheet so it's mounted once at the screen level
  /// rather than per-row.
  onPassRequest?: (conversationId: string) => void;
}

/// Small text label shown under the partner name when the conversation
/// is in a closure-loop terminal/pending state.
function statusBadgeText(status: InboxItem['status']): string | null {
  switch (status) {
    case 'active':        return null;
    case 'passed':        return 'Passed';
    case 'hired':         return 'Hired ✓';
    case 'hired_pending': return 'Confirm hire?';
    case 'auto_declined': return 'Auto-declined';
    default:              return null;
  }
}

export function InboxRow({ item, meId, onPress, onPassRequest }: Props) {
  const sentByMe = item.last_message_sender_id === meId;
  const initial = (item.partner_name ?? '?').slice(0, 1).toUpperCase();
  const swipeRef = useRef<Swipeable>(null);
  const statusBadge = statusBadgeText(item.status);
  const passable = item.status === 'active' && !!onPassRequest;

  const handlePass = () => {
    swipeRef.current?.close();
    if (onPassRequest) onPassRequest(item.conversation_id);
  };

  /// The right-action panel revealed on left-swipe. Translates in with
  /// the swipe so it feels mass-bound to the row rather than popping in.
  const renderRightActions = (progress: Animated.AnimatedInterpolation<number>) => {
    if (!passable) return null;
    const translateX = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [80, 0],
    });
    return (
      <Animated.View style={[styles.actionWrap, { transform: [{ translateX }] }]}>
        <Pressable onPress={handlePass} style={styles.passAction} accessibilityLabel="Pass">
          <X size={18} color={Brand.inkOnBrand} weight="bold" />
          <Text style={styles.passActionLabel}>Pass</Text>
        </Pressable>
      </Animated.View>
    );
  };

  /// Attachment-only messages render an inline Phosphor paperclip + "Photo"
  /// label in the preview line. Body-only and deleted messages render as
  /// plain text. The "You: " prefix sits before either path.
  const isAttachmentOnly =
    !item.last_message_deleted &&
    !item.last_message_body &&
    !!item.last_message_attachment_url;

  const previewText = item.last_message_deleted
    ? 'Message deleted'
    : item.last_message_body
      ? item.last_message_body
      : item.last_message_attachment_url
        ? 'Photo'
        : 'Say hi';

  return (
    <Swipeable
      ref={swipeRef}
      enabled={passable}
      renderRightActions={renderRightActions}
      friction={2}
      rightThreshold={36}
    >
    <Pressable onPress={onPress} style={({ pressed }) => [
      styles.row,
      pressed && { opacity: 0.7 },
    ]}>
      <View style={styles.avatarWrap}>
        {item.partner_photo_url ? (
          <Image source={{ uri: item.partner_photo_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarFallbackText}>{initial}</Text>
          </View>
        )}
      </View>

      <View style={styles.body}>
        <View style={styles.headerLine}>
          <Text style={styles.name} numberOfLines={1}>
            {item.partner_name ?? 'Someone'}
          </Text>
          <Text style={styles.time}>{formatRelative(item.last_message_at)}</Text>
        </View>
        <View style={styles.subHeaderLine}>
          <Text style={styles.project} numberOfLines={1}>
            on {item.project_title}
          </Text>
          {statusBadge && (
            <View
              style={[
                styles.statusBadge,
                item.status === 'hired' && styles.statusBadgeHired,
                item.status === 'hired_pending' && styles.statusBadgePending,
                (item.status === 'passed' || item.status === 'auto_declined') && styles.statusBadgeMuted,
              ]}
            >
              <Text
                style={[
                  styles.statusBadgeText,
                  item.status === 'hired' && styles.statusBadgeTextHired,
                ]}
              >
                {statusBadge}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.previewLine}>
          <View style={styles.previewTextWrap}>
            {sentByMe && (
              <Text
                style={[styles.preview, item.unread_count > 0 && !sentByMe && styles.previewUnread]}
              >
                You:{' '}
              </Text>
            )}
            {isAttachmentOnly && (
              <Paperclip
                size={13}
                color={item.unread_count > 0 && !sentByMe ? Brand.inkBody : Brand.inkMuted}
                weight="regular"
                style={styles.previewIcon}
              />
            )}
            <Text
              style={[
                styles.preview,
                styles.previewBody,
                item.unread_count > 0 && !sentByMe && styles.previewUnread,
              ]}
              numberOfLines={1}
            >
              {previewText}
            </Text>
          </View>
          {item.unread_count > 0 && !sentByMe && (
            <View style={styles.unreadDot}>
              <Text style={styles.unreadDotText}>
                {item.unread_count > 9 ? '9+' : item.unread_count}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
    </Swipeable>
  );
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const sec = Math.floor((now - then) / 1000);
  if (sec < 60)   return 'now';
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
  const days = Math.floor(sec / 86400);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: Space.lg,
    paddingVertical: 12,
  },
  avatarWrap: { width: 52, height: 52 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  avatarFallback: {
    backgroundColor: Brand.seekerSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    fontFamily: AmbitFont.display,
    fontSize: 22,
    color: Brand.seekerInk,
  },

  body: { flex: 1, gap: 2 },
  headerLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    flex: 1,
    fontFamily: AmbitFont.body,
    fontSize: 15,
    fontWeight: '600',
    color: Brand.inkHigh,
  },
  time: {
    fontFamily: AmbitFont.body,
    fontSize: 11,
    color: Brand.inkMuted,
  },
  subHeaderLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  project: {
    flex: 1,
    fontFamily: AmbitFont.body,
    fontSize: 12,
    color: Brand.accent,
  },

  // Closure-loop status badge. Three flavors: hired (warm), pending
  // (primary), and muted (passed / auto-declined).
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: Brand.surface2,
  },
  statusBadgeText: {
    fontFamily: AmbitFont.body,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
    color: Brand.inkLabel,
  },
  statusBadgeMuted:    { backgroundColor: Brand.surface2 },
  statusBadgeHired:    { backgroundColor: Brand.primary },
  statusBadgePending:  { backgroundColor: Brand.seekerSurface },
  statusBadgeTextHired: { color: Brand.inkOnBrand },

  // Pass swipe action — revealed under the row from the right edge.
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
    fontFamily: AmbitFont.body,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: Brand.inkOnBrand,
  },
  previewLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  previewTextWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  previewIcon: {
    marginRight: 4,
  },
  preview: {
    fontFamily: AmbitFont.body,
    fontSize: 13,
    color: Brand.inkMuted,
  },
  previewBody: {
    flex: 1,
  },
  previewUnread: {
    color: Brand.inkBody,
    fontWeight: '600',
  },
  unreadDot: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  unreadDotText: {
    fontFamily: AmbitFont.body,
    fontSize: 10,
    fontWeight: '700',
    color: Brand.inkOnBrand,
  },
});
