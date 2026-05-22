import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { InboxItem } from '../../lib/messaging';
import { AmbitFont, Brand, Radii, Space } from '../../constants/theme';

interface Props {
  item:      InboxItem;
  meId:      string;
  onPress:   () => void;
}

export function InboxRow({ item, meId, onPress }: Props) {
  const sentByMe = item.last_message_sender_id === meId;
  const initial = (item.partner_name ?? '?').slice(0, 1).toUpperCase();

  const preview = item.last_message_deleted
    ? 'Message deleted'
    : item.last_message_body
      ? item.last_message_body
      : item.last_message_attachment_url
        ? '📎 Attachment'
        : 'Say hi';

  const previewLine = sentByMe ? `You: ${preview}` : preview;

  return (
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
        <Text style={styles.project} numberOfLines={1}>
          on {item.project_title}
        </Text>
        <View style={styles.previewLine}>
          <Text
            style={[styles.preview, item.unread_count > 0 && !sentByMe && styles.previewUnread]}
            numberOfLines={1}
          >
            {previewLine}
          </Text>
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
  project: {
    fontFamily: AmbitFont.body,
    fontSize: 12,
    color: Brand.accent,
  },
  previewLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  preview: {
    flex: 1,
    fontFamily: AmbitFont.body,
    fontSize: 13,
    color: Brand.inkMuted,
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
