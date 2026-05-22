import React, { useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { PaperPlaneTilt, Paperclip, X, PencilSimple } from 'phosphor-react-native';
import type { MessageRow } from '../../lib/messaging';
import { AmbitFont, Brand, Radii, Space } from '../../constants/theme';

interface Props {
  /// When set, the composer shows a quoted preview above the input and
  /// submit will reply to this message.
  replyTo?:        MessageRow | null;
  onClearReply:    () => void;
  /// When set, the composer is in edit mode: input is pre-filled, submit
  /// updates the existing message instead of sending a new one.
  editing?:        MessageRow | null;
  onClearEditing:  () => void;
  nameById:        Record<string, string>;

  onSendText:      (body: string) => Promise<void> | void;
  onSendImage:     (localUri: string) => Promise<void> | void;
  onSaveEdit:      (body: string) => Promise<void> | void;
  /// Fired on every meaningful keystroke. Caller debounces & broadcasts
  /// presence; the composer just signals intent.
  onTypingPing:    () => void;
}

/// Two modes: normal (send) or editing (save). Image upload is disabled
/// while editing — keeps the data model simple (no "swap attachment"
/// path) and matches WhatsApp's behavior.
export function ChatComposer({
  replyTo,
  onClearReply,
  editing,
  onClearEditing,
  nameById,
  onSendText,
  onSendImage,
  onSaveEdit,
  onTypingPing,
}: Props) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const lastPingRef = useRef(0);

  // Sync text into the editor when an edit starts. Using key change in the
  // parent could also do this; keeping it local avoids a remount on every
  // edit-start.
  React.useEffect(() => {
    if (editing) setText(editing.body ?? '');
    else setText('');
  }, [editing?.id]);

  const handleChange = (v: string) => {
    setText(v);
    // Throttle typing pings to one per 1.5s while the field is being edited.
    const now = Date.now();
    if (now - lastPingRef.current > 1500) {
      lastPingRef.current = now;
      onTypingPing();
    }
  };

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      if (editing) await onSaveEdit(trimmed);
      else         await onSendText(trimmed);
      setText('');
    } finally {
      setSending(false);
    }
  };

  const pickImage = async () => {
    if (editing) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsMultipleSelection: false,
    });
    if (result.canceled || result.assets.length === 0) return;
    setSending(true);
    try {
      await onSendImage(result.assets[0].uri);
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.root}>
      {replyTo && (
        <View style={styles.banner}>
          <View style={styles.bannerBar} />
          <View style={styles.bannerText}>
            <Text style={styles.bannerTitle} numberOfLines={1}>
              Replying to {nameById[replyTo.sender_id] ?? 'them'}
            </Text>
            <Text style={styles.bannerBody} numberOfLines={1}>
              {replyTo.body ?? (replyTo.attachment_url ? '📎 Attachment' : '')}
            </Text>
          </View>
          <Pressable onPress={onClearReply} hitSlop={10}>
            <X size={16} color={Brand.inkMuted} weight="bold" />
          </Pressable>
        </View>
      )}

      {editing && (
        <View style={styles.banner}>
          <PencilSimple size={14} color={Brand.accent} weight="regular" />
          <View style={styles.bannerText}>
            <Text style={styles.bannerTitle}>Editing message</Text>
          </View>
          <Pressable onPress={onClearEditing} hitSlop={10}>
            <X size={16} color={Brand.inkMuted} weight="bold" />
          </Pressable>
        </View>
      )}

      <View style={styles.inputRow}>
        {!editing && (
          <Pressable
            onPress={pickImage}
            hitSlop={10}
            style={styles.iconBtn}
            accessibilityLabel="Attach image"
          >
            <Paperclip size={20} color={Brand.inkMuted} weight="regular" />
          </Pressable>
        )}

        <TextInput
          value={text}
          onChangeText={handleChange}
          placeholder={editing ? 'Edit message…' : 'Message…'}
          placeholderTextColor={Brand.inkPlaceholder}
          multiline
          style={styles.input}
        />

        <Pressable
          onPress={submit}
          disabled={sending || !text.trim()}
          style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
          accessibilityLabel={editing ? 'Save edit' : 'Send'}
        >
          <PaperPlaneTilt size={16} color={Brand.inkOnBrand} weight="fill" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: Brand.canvas,
    borderTopWidth: 1,
    borderTopColor: Brand.borderDefault,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: Space.md,
    paddingVertical: 8,
    backgroundColor: Brand.surface1,
    borderTopWidth: 1,
    borderTopColor: Brand.borderDefault,
  },
  bannerBar: {
    width: 3,
    height: 28,
    backgroundColor: Brand.accent,
    borderRadius: 2,
  },
  bannerText: { flex: 1 },
  bannerTitle: {
    fontFamily: AmbitFont.body,
    fontSize: 12,
    fontWeight: '600',
    color: Brand.accent,
  },
  bannerBody: {
    fontFamily: AmbitFont.body,
    fontSize: 12,
    color: Brand.inkMuted,
    marginTop: 1,
  },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: Space.md,
    paddingVertical: 8,
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  input: {
    flex: 1,
    minHeight: 38,
    maxHeight: 120,
    backgroundColor: Brand.surface1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontFamily: AmbitFont.body,
    fontSize: 15,
    color: Brand.inkBody,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 0,
  },
  sendBtnDisabled: { opacity: 0.4 },
});
