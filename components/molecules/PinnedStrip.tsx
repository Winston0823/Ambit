import React from 'react';
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { InboxItem } from '../../lib/messaging';
import { isReachedOutToYou } from '../../lib/messaging';
import { Brand } from '../../constants/theme';

interface Props {
  items:   InboxItem[];
  meId:    string;
  onPress: (conversationId: string) => void;
  /// Long-press → unpin via parent. Same handler InboxRow uses for
  /// the toggle; parent routes pinned items to unpin().
  onLongPress?: (item: InboxItem) => void;
}

/// iMessage-parity pinned strip — quiet horizontal scroll of circular
/// avatars with the partner's first name under each. Only renders when
/// there's at least one pinned conversation. A small preview pip floats
/// over a tile when that pinned chat has unread messages.
export function PinnedStrip({ items, meId, onPress, onLongPress }: Props) {
  if (items.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Pinned</Text>
      <FlatList
        data={items}
        keyExtractor={(it) => it.conversation_id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rowContent}
        renderItem={({ item }) => (
          <PinnedTile
            item={item}
            meId={meId}
            onPress={() => onPress(item.conversation_id)}
            onLongPress={onLongPress ? () => onLongPress(item) : undefined}
          />
        )}
      />
    </View>
  );
}

function PinnedTile({
  item,
  meId,
  onPress,
  onLongPress,
}: {
  item:    InboxItem;
  meId:    string;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const initial = (item.partner_name ?? '?').slice(0, 1).toUpperCase();
  const firstName = (item.partner_name ?? 'Chat').split(' ')[0];
  const hasUnread = item.unread_count > 0 || isReachedOutToYou(item, meId);
  const previewText = item.last_message_deleted
    ? null
    : item.last_message_body
      ? item.last_message_body
      : item.last_message_attachment_url
        ? 'Photo'
        : null;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={300}
      style={({ pressed }) => [styles.tile, pressed && { opacity: 0.7 }]}
    >
      <View style={styles.avatarWrap}>
        {item.partner_photo_url ? (
          <Image source={{ uri: item.partner_photo_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarInitial}>{initial}</Text>
          </View>
        )}
        {hasUnread && previewText && (
          <View style={styles.bubble}>
            <Text style={styles.bubbleText} numberOfLines={1}>
              {previewText}
            </Text>
          </View>
        )}
      </View>
      <Text style={styles.name} numberOfLines={1}>{firstName}</Text>
    </Pressable>
  );
}

const TILE_W   = 64;
const AVATAR_S = 64;

const styles = StyleSheet.create({
  wrap: {
    paddingTop: 6,
    paddingBottom: 8,
  },
  label: {
    paddingHorizontal: 22,
    paddingBottom: 12,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 2.4,
    color: Brand.inboxInkMute,
  },
  rowContent: {
    paddingHorizontal: 22,
    gap: 16,
    alignItems: 'flex-start',
  },
  tile: {
    width: TILE_W,
    alignItems: 'center',
    gap: 6,
  },
  avatarWrap: {
    width: AVATAR_S,
    height: AVATAR_S,
    position: 'relative',
  },
  avatar: {
    width: AVATAR_S,
    height: AVATAR_S,
    borderRadius: AVATAR_S / 2,
  },
  avatarFallback: {
    backgroundColor: Brand.inboxAvatarBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(196,199,199,0.3)',
  },
  avatarInitial: {
    fontFamily: 'Zodiak-Bold',
    fontStyle: 'italic',
    fontSize: 20,
    color: Brand.inboxBronzeDim,
    letterSpacing: -0.2,
  },
  // Floating preview pip on the top-left of the tile — iMessage cue
  // that this pinned chat has an unread message.
  bubble: {
    position: 'absolute',
    top: -4,
    left: -18,
    maxWidth: 96,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: Brand.inboxCanvas,
    borderRadius: 12,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: Brand.inboxHairline,
    zIndex: 2,
  },
  bubbleText: {
    fontSize: 10.5,
    color: Brand.inboxInkBody,
    lineHeight: 12,
  },
  name: {
    fontSize: 12,
    fontWeight: '500',
    color: Brand.inboxInkBody,
    letterSpacing: -0.1,
    textAlign: 'center',
    width: '100%',
  },
});
