import React, { useEffect, useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Check, Checks, PencilSimple } from 'phosphor-react-native';
import type { MessageRow, ReactionRow } from '../../lib/messaging';
import { signAttachmentUrl } from '../../lib/messaging';
import { AmbitFont, Brand, Radii, Space } from '../../constants/theme';

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
  /// Tap reaction chip → toggle off / on (caller routes to toggleReaction).
  onToggleReaction: (emoji: string) => void;
  /// Long press → action sheet (react / reply / copy / edit / delete).
  onLongPress:   () => void;
}

/// Hooks for the resolved (signed) attachment URL. Resigning is cheap;
/// we keep it scoped per-bubble so it expires with the component.
function useAttachmentUrl(path: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!path) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    signAttachmentUrl(path).then((u) => {
      if (!cancelled) setUrl(u);
    });
    return () => {
      cancelled = true;
    };
  }, [path]);
  return url;
}

export function MessageBubble({
  message,
  isMine,
  reactions,
  nameById,
  parent,
  partnerLastReadAt,
  meId,
  onToggleReaction,
  onLongPress,
}: Props) {
  const attachmentUrl = useAttachmentUrl(message.attachment_url);
  const isDeleted = !!message.deleted_at;
  const wasEdited = !!message.edited_at && !isDeleted;

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
    <View style={[styles.row, isMine ? styles.rowMine : styles.rowTheirs]}>
      <Pressable
        onLongPress={isDeleted ? undefined : onLongPress}
        delayLongPress={250}
        style={[
          styles.bubble,
          isMine ? styles.bubbleMine : styles.bubbleTheirs,
          isDeleted && styles.bubbleDeleted,
        ]}
      >
        {/* Reply preview — small bar above the body that quotes the parent. */}
        {parent && (
          <View style={[styles.replyQuote, isMine && styles.replyQuoteMine]}>
            <Text
              style={[styles.replyAuthor, isMine && styles.replyAuthorMine]}
              numberOfLines={1}
            >
              {nameById[parent.sender_id] ?? 'Unknown'}
            </Text>
            <Text
              style={[styles.replyBody, isMine && styles.replyBodyMine]}
              numberOfLines={2}
            >
              {parent.deleted_at
                ? 'Message deleted'
                : parent.body ?? (parent.attachment_url ? '📎 Attachment' : '')}
            </Text>
          </View>
        )}

        {/* Image attachment. */}
        {attachmentUrl && !isDeleted && (
          <Image source={{ uri: attachmentUrl }} style={styles.image} resizeMode="cover" />
        )}

        {/* Body. */}
        {isDeleted ? (
          <Text style={[styles.tombstone, isMine && styles.tombstoneMine]}>
            Message deleted
          </Text>
        ) : message.body ? (
          <Text style={[styles.body, isMine && styles.bodyMine]}>{message.body}</Text>
        ) : null}

        {/* Meta row: timestamp + edited badge + read receipt. */}
        <View style={styles.metaRow}>
          {wasEdited && (
            <View style={styles.editedPill}>
              <PencilSimple
                size={9}
                color={isMine ? Brand.inkOnBrand : Brand.inkMuted}
                weight="regular"
              />
              <Text style={[styles.editedText, isMine && styles.editedTextMine]}>
                edited
              </Text>
            </View>
          )}
          <Text style={[styles.time, isMine && styles.timeMine]}>
            {formatTime(message.created_at)}
          </Text>
          {isMine && !isDeleted && (
            readByPartner ? (
              <Checks size={13} color={Brand.inkOnBrand} weight="bold" />
            ) : (
              <Check size={13} color={Brand.inkOnBrand} weight="bold" />
            )
          )}
        </View>
      </Pressable>

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
    </View>
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

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: Space.md,
    marginVertical: 3,
  },
  rowMine:   { alignItems: 'flex-end' },
  rowTheirs: { alignItems: 'flex-start' },

  bubble: {
    maxWidth: '78%',
    borderRadius: Radii.lg,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
  bubbleMine: {
    backgroundColor: Brand.primary,
    borderBottomRightRadius: 6,
  },
  bubbleTheirs: {
    backgroundColor: Brand.surface1,
    borderBottomLeftRadius: 6,
  },
  bubbleDeleted: { opacity: 0.65 },

  body: {
    fontFamily: AmbitFont.body,
    fontSize: 15,
    color: Brand.inkBody,
    lineHeight: 20,
  },
  bodyMine: { color: Brand.inkOnBrand },

  tombstone: {
    fontFamily: AmbitFont.body,
    fontSize: 14,
    fontStyle: 'italic',
    color: Brand.inkMuted,
  },
  tombstoneMine: { color: Brand.inkOnBrand },

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
  replyBodyMine: { color: 'rgba(255,255,255,0.85)' },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-end',
    marginTop: 2,
  },
  time: {
    fontFamily: AmbitFont.body,
    fontSize: 10,
    color: Brand.inkMuted,
  },
  timeMine: { color: 'rgba(255,255,255,0.85)' },

  editedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  editedText: {
    fontFamily: AmbitFont.body,
    fontSize: 10,
    color: Brand.inkMuted,
    fontStyle: 'italic',
  },
  editedTextMine: { color: 'rgba(255,255,255,0.85)' },

  reactionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
    maxWidth: '78%',
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
