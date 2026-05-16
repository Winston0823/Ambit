import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Avatar, Badge } from '../atoms';
import { Colors, Spacing, Typography } from '../../constants/theme';

interface ChatListItemProps {
  name: string;
  photo: string;
  neighborhood: string;
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
  onPress: () => void;
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHrs = diffMs / (1000 * 60 * 60);

  if (diffHrs < 1) return `${Math.round(diffMs / 60000)}m`;
  if (diffHrs < 24) return `${Math.round(diffHrs)}h`;
  if (diffHrs < 48) return 'Yesterday';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function ChatListItem({ name, photo, neighborhood, lastMessage, timestamp, unreadCount, onPress }: ChatListItemProps) {
  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      <Avatar uri={photo} name={name} size="lg" />
      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          <Text style={[styles.timestamp, unreadCount > 0 && styles.timestampUnread]}>
            {formatTimestamp(timestamp)}
          </Text>
        </View>
        <View style={styles.bottomRow}>
          <Text style={[styles.message, unreadCount > 0 && styles.messageUnread]} numberOfLines={2}>
            {lastMessage}
          </Text>
          {unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        <Badge label={neighborhood} variant="neighborhood" />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: Spacing.md,
    gap: Spacing.sm + 4,
    backgroundColor: Colors.white,
  },
  content: {
    flex: 1,
    gap: Spacing.xs,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: {
    ...Typography.name,
    fontSize: 16,
    flex: 1,
  },
  timestamp: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  timestampUnread: {
    color: Colors.brandGreen,
    fontWeight: '600',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  message: {
    ...Typography.caption,
    flex: 1,
    color: Colors.textTertiary,
  },
  messageUnread: {
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  unreadBadge: {
    backgroundColor: Colors.brandGreen,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
});
