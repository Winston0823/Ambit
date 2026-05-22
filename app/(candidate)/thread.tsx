import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { BackChevron } from '../../components/atoms';
import {
  MessageBubble,
  TypingIndicator,
} from '../../components/molecules';
import { ChatComposer } from '../../components/organisms';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import {
  deleteMessage,
  editMessage,
  listMessages,
  listReactions,
  markConversationRead,
  sendImageMessage,
  sendTextMessage,
  toggleReaction,
  type MessageRow,
  type ReactionRow,
} from '../../lib/messaging';
import { AmbitFont, Brand, Radii, Space } from '../../constants/theme';

const QUICK_REACTIONS = ['👍', '❤️', '😂', '🙏', '🔥', '👀'];

interface ConvoMeta {
  id:                string;
  project_id:        string;
  project_title:     string;
  owner_id:          string;
  seeker_id:         string;
  partner_id:        string;
  partner_name:      string;
  partner_photo_url: string | null;
}

/// S-051 Message Thread. Wires together:
///   - initial fetch (messages + reactions + conversation meta)
///   - realtime: postgres_changes on messages + reactions + reads
///   - typing presence via realtime broadcast
///   - mark-as-read on focus
///   - long-press action menu (react / reply / copy / edit / delete)
export default function ThreadScreen() {
  const { id: conversationId } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [meta, setMeta] = useState<ConvoMeta | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [reactions, setReactions] = useState<ReactionRow[]>([]);
  const [partnerLastReadAt, setPartnerLastReadAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [replyTo, setReplyTo] = useState<MessageRow | null>(null);
  const [editing, setEditing] = useState<MessageRow | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<MessageRow | null>(null);

  const [partnerTyping, setPartnerTyping] = useState(false);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const listRef = useRef<FlatList<MessageRow>>(null);

  // ── Initial load ─────────────────────────────────────────────
  useEffect(() => {
    if (!conversationId || !user) return;
    let cancelled = false;

    (async () => {
      // Conversation row + project title. profiles isn't directly FK'd
      // from conversations (both point at auth.users), so we fetch the
      // partner profile in a second query rather than via Postgrest join.
      const { data: convo, error } = await supabase
        .from('conversations')
        .select('id, project_id, owner_id, seeker_id, projects(title)')
        .eq('id', conversationId)
        .single();

      if (error || !convo) {
        Alert.alert('Conversation not found');
        router.back();
        return;
      }

      const isOwner = convo.owner_id === user.id;
      const partnerId = isOwner ? convo.seeker_id : convo.owner_id;

      const { data: partnerProfile } = await supabase
        .from('profiles')
        .select('name, photo_url')
        .eq('id', partnerId)
        .maybeSingle();

      const partner: ConvoMeta = {
        id:                convo.id,
        project_id:        convo.project_id,
        project_title:     (convo.projects as any)?.title ?? '',
        owner_id:          convo.owner_id,
        seeker_id:         convo.seeker_id,
        partner_id:        partnerId,
        partner_name:      partnerProfile?.name ?? (isOwner ? 'Seeker' : 'Owner'),
        partner_photo_url: partnerProfile?.photo_url ?? null,
      };

      const [msgs, reacts, partnerRead] = await Promise.all([
        listMessages(conversationId, { limit: 200 }),
        listReactions(conversationId),
        supabase
          .from('conversation_reads')
          .select('last_read_at')
          .eq('conversation_id', conversationId)
          .eq('user_id', partner.partner_id)
          .maybeSingle()
          .then(({ data }) => data?.last_read_at ?? null),
      ]);

      if (cancelled) return;
      setMeta(partner);
      setMessages(msgs);
      setReactions(reacts);
      setPartnerLastReadAt(partnerRead);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [conversationId, user?.id]);

  // ── Realtime ─────────────────────────────────────────────────
  useEffect(() => {
    if (!conversationId || !user) return;

    const ch = supabase.channel(`conv:${conversationId}`, {
      config: { presence: { key: user.id } },
    });

    ch.on(
      'postgres_changes',
      {
        event:  '*',
        schema: 'public',
        table:  'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        if (payload.eventType === 'INSERT') {
          setMessages((prev) => {
            const row = payload.new as MessageRow;
            if (prev.some((m) => m.id === row.id)) return prev;
            return [...prev, row];
          });
        } else if (payload.eventType === 'UPDATE') {
          const row = payload.new as MessageRow;
          setMessages((prev) => prev.map((m) => (m.id === row.id ? row : m)));
        } else if (payload.eventType === 'DELETE') {
          const row = payload.old as MessageRow;
          setMessages((prev) => prev.filter((m) => m.id !== row.id));
        }
      },
    );

    ch.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'message_reactions' },
      (payload) => {
        if (payload.eventType === 'INSERT') {
          const row = payload.new as ReactionRow;
          setReactions((prev) =>
            prev.some(
              (r) =>
                r.message_id === row.message_id &&
                r.user_id === row.user_id &&
                r.emoji === row.emoji,
            )
              ? prev
              : [...prev, row],
          );
        } else if (payload.eventType === 'DELETE') {
          const row = payload.old as ReactionRow;
          setReactions((prev) =>
            prev.filter(
              (r) =>
                !(
                  r.message_id === row.message_id &&
                  r.user_id === row.user_id &&
                  r.emoji === row.emoji
                ),
            ),
          );
        }
      },
    );

    ch.on(
      'postgres_changes',
      {
        event:  'UPDATE',
        schema: 'public',
        table:  'conversation_reads',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        const row = payload.new as { user_id: string; last_read_at: string };
        if (row.user_id !== user.id) setPartnerLastReadAt(row.last_read_at);
      },
    );

    ch.on('broadcast', { event: 'typing' }, ({ payload }) => {
      if (payload.userId === user.id) return;
      setPartnerTyping(true);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => setPartnerTyping(false), 3000);
    });

    ch.subscribe();
    channelRef.current = ch;

    return () => {
      ch.unsubscribe();
      channelRef.current = null;
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, [conversationId, user?.id]);

  // ── Mark read on focus (and on each new message arrival) ─────
  useFocusEffect(
    useCallback(() => {
      if (conversationId) markConversationRead(conversationId);
    }, [conversationId]),
  );
  useEffect(() => {
    if (conversationId && messages.length > 0) {
      markConversationRead(conversationId);
    }
  }, [conversationId, messages.length]);

  // ── Auto-scroll on new message ───────────────────────────────
  useEffect(() => {
    if (messages.length === 0) return;
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  }, [messages.length]);

  // ── Name map for bubble labels ───────────────────────────────
  const nameById = useMemo<Record<string, string>>(() => {
    if (!meta || !user) return {};
    return {
      [user.id]:         'You',
      [meta.partner_id]: meta.partner_name,
    };
  }, [meta, user]);

  // ── Reactions index ──────────────────────────────────────────
  const reactionsByMessage = useMemo(() => {
    const map: Record<string, ReactionRow[]> = {};
    for (const r of reactions) (map[r.message_id] ??= []).push(r);
    return map;
  }, [reactions]);

  // ── Handlers ─────────────────────────────────────────────────
  const handleSendText = async (body: string) => {
    if (!user) return;
    await sendTextMessage({
      conversationId: conversationId!,
      senderId:       user.id,
      body,
      parentId:       replyTo?.id ?? null,
    });
    setReplyTo(null);
  };

  const handleSendImage = async (localUri: string) => {
    if (!user) return;
    try {
      await sendImageMessage({
        conversationId: conversationId!,
        senderId:       user.id,
        localUri,
        parentId:       replyTo?.id ?? null,
      });
      setReplyTo(null);
    } catch (e: any) {
      Alert.alert('Upload failed', e?.message ?? 'Try again.');
    }
  };

  const handleSaveEdit = async (body: string) => {
    if (!editing) return;
    await editMessage(editing.id, body);
    setEditing(null);
  };

  const handleTypingPing = () => {
    channelRef.current?.send({
      type:    'broadcast',
      event:   'typing',
      payload: { userId: user?.id },
    });
  };

  const handleToggleReaction = async (message: MessageRow, emoji: string) => {
    if (!user) return;
    try {
      await toggleReaction({ messageId: message.id, userId: user.id, emoji });
    } catch (e: any) {
      console.warn('toggle reaction failed:', e?.message);
    }
  };

  const handleLongPress = (m: MessageRow) => setSelectedMessage(m);

  const handleMenuAction = async (action: 'reply' | 'copy' | 'edit' | 'delete') => {
    const m = selectedMessage;
    setSelectedMessage(null);
    if (!m) return;
    if (action === 'reply') setReplyTo(m);
    else if (action === 'copy') {
      if (m.body) await Clipboard.setStringAsync(m.body);
    } else if (action === 'edit') {
      if (m.sender_id === user?.id && m.body) setEditing(m);
    } else if (action === 'delete') {
      Alert.alert('Delete message?', 'This cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: () => deleteMessage(m.id).catch((e) =>
            Alert.alert('Delete failed', e?.message ?? '')),
        },
      ]);
    }
  };

  const handleQuickReact = async (emoji: string) => {
    const m = selectedMessage;
    setSelectedMessage(null);
    if (!m || !user) return;
    await toggleReaction({ messageId: m.id, userId: user.id, emoji });
  };

  // ── Render ───────────────────────────────────────────────────
  if (loading || !meta || !user) {
    return (
      <View style={[styles.root, styles.center]}>
        <BackChevron onPress={() => router.back()} />
        <ActivityIndicator color={Brand.accent} />
      </View>
    );
  }

  const isOwnSelected = selectedMessage?.sender_id === user.id;

  return (
    <View style={styles.root}>
      <BackChevron onPress={() => router.back()} />

      {/* Header. Sits above the safe-area inset; the BackChevron is
          absolutely positioned by the atom itself. */}
      <View style={[styles.header, { paddingTop: insets.top + 40 }]}>
        <Text style={styles.partnerName} numberOfLines={1}>
          {meta.partner_name}
        </Text>
        <Text style={styles.projectLine} numberOfLines={1}>
          on {meta.project_title}
        </Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const parent = item.parent_id
              ? messages.find((m) => m.id === item.parent_id) ?? null
              : null;
            return (
              <MessageBubble
                message={item}
                isMine={item.sender_id === user.id}
                reactions={reactionsByMessage[item.id] ?? []}
                nameById={nameById}
                parent={parent}
                partnerLastReadAt={partnerLastReadAt}
                meId={user.id}
                onToggleReaction={(emoji) => handleToggleReaction(item, emoji)}
                onLongPress={() => handleLongPress(item)}
              />
            );
          }}
          ListFooterComponent={partnerTyping ? (
            <TypingIndicator name={meta.partner_name.split(' ')[0]} />
          ) : null}
        />

        <ChatComposer
          replyTo={replyTo}
          onClearReply={() => setReplyTo(null)}
          editing={editing}
          onClearEditing={() => setEditing(null)}
          nameById={nameById}
          onSendText={handleSendText}
          onSendImage={handleSendImage}
          onSaveEdit={handleSaveEdit}
          onTypingPing={handleTypingPing}
        />
      </KeyboardAvoidingView>

      {/* Action sheet on long-press. Modal so it lives above keyboard. */}
      <Modal
        visible={!!selectedMessage}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedMessage(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setSelectedMessage(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.reactRow}>
              {QUICK_REACTIONS.map((e) => (
                <Pressable
                  key={e}
                  onPress={() => handleQuickReact(e)}
                  style={styles.reactBtn}
                >
                  <Text style={styles.reactEmoji}>{e}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.menuDivider} />
            <MenuButton label="Reply" onPress={() => handleMenuAction('reply')} />
            {selectedMessage?.body ? (
              <MenuButton label="Copy" onPress={() => handleMenuAction('copy')} />
            ) : null}
            {isOwnSelected && selectedMessage?.body ? (
              <MenuButton label="Edit" onPress={() => handleMenuAction('edit')} />
            ) : null}
            {isOwnSelected ? (
              <MenuButton label="Delete" onPress={() => handleMenuAction('delete')} destructive />
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function MenuButton({
  label,
  onPress,
  destructive,
}: {
  label: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [
      styles.menuBtn,
      pressed && { backgroundColor: Brand.surface2 },
    ]}>
      <Text style={[styles.menuLabel, destructive && { color: Brand.accent }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.canvas },
  center: { alignItems: 'center', justifyContent: 'center' },

  header: {
    paddingHorizontal: Space.lg,
    paddingBottom: Space.md,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Brand.borderDefault,
  },
  partnerName: {
    fontFamily: AmbitFont.display,
    fontSize: 18,
    color: Brand.inkPrimary,
  },
  projectLine: {
    fontFamily: AmbitFont.body,
    fontSize: 12,
    color: Brand.accent,
    marginTop: 2,
  },

  listContent: {
    paddingVertical: Space.md,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Brand.canvas,
    borderTopLeftRadius: Radii.lg,
    borderTopRightRadius: Radii.lg,
    paddingTop: 12,
    paddingBottom: 36,
    paddingHorizontal: Space.md,
  },
  reactRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
  },
  reactBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactEmoji: { fontSize: 24 },
  menuDivider: {
    height: 1,
    backgroundColor: Brand.borderDefault,
    marginVertical: 8,
  },
  menuBtn: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: Radii.md,
  },
  menuLabel: {
    fontFamily: AmbitFont.body,
    fontSize: 16,
    color: Brand.inkBody,
  },
});
