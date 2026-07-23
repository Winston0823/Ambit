import React from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { InboxItem } from '../../lib/messaging';
import { isReachedOutToYou } from '../../lib/messaging';
import { Avatar } from '../atoms';
import { AmbitFont, Brand } from '../../constants/theme';

interface Props {
  items:   InboxItem[];
  meId:    string;
  /// Revealed real photos keyed by partner id (mutual conversations only).
  /// A tile with no entry renders the monster mark.
  revealed: Map<string, string>;
  onPress: (conversationId: string) => void;
  /// Long-press → unpin via parent. Same handler InboxRow uses for
  /// the toggle; parent routes pinned items to unpin().
  onLongPress?: (item: InboxItem) => void;
}

/// iMessage-parity pinned strip — quiet horizontal scroll of circular
/// avatars with the partner's first name under each. Only renders when
/// there's at least one pinned conversation. A small preview pip floats
/// over a tile when that pinned chat has unread messages.
export function PinnedStrip({ items, meId, revealed, onPress, onLongPress }: Props) {
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
            photoUrl={revealed.get(item.partner_id) ?? null}
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
  photoUrl,
  onPress,
  onLongPress,
}: {
  item:    InboxItem;
  meId:    string;
  photoUrl: string | null;
  onPress: () => void;
  onLongPress?: () => void;
}) {
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
        <Avatar avatarId={item.partner_avatar_id} photoUrl={photoUrl} size={AVATAR_S} />
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
    paddingTop: 8,
    paddingBottom: 8,
  },
  label: {
    paddingHorizontal: 24,
    paddingBottom: 12,
    fontFamily: AmbitFont.body,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
    color: Brand.inkLabel,
  },
  rowContent: {
    paddingHorizontal: 24,
    gap: 16,
    alignItems: 'flex-start',
  },
  tile: {
    width: TILE_W,
    alignItems: 'center',
    gap: 8,
  },
  avatarWrap: {
    width: AVATAR_S,
    height: AVATAR_S,
    position: 'relative',
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
    backgroundColor: Brand.cardCream,
    borderRadius: 12,
    borderBottomLeftRadius: 4,
    borderWidth: 1.5,
    borderColor: Brand.inkEdge,
    zIndex: 2,
  },
  bubbleText: {
    fontFamily: AmbitFont.body,
    fontSize: 10.5,
    color: Brand.inkBody,
    lineHeight: 12,
  },
  name: {
    fontFamily: AmbitFont.body,
    fontSize: 12,
    fontWeight: '500',
    color: Brand.inkBody,
    letterSpacing: -0.1,
    textAlign: 'center',
    width: '100%',
  },
});
