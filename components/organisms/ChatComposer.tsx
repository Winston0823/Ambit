import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  LayoutAnimation,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  CalendarPlus,
  Camera,
  Clock,
  FileText,
  ImageSquare,
  MapPin,
  PaperPlaneTilt,
  Paperclip,
  PencilSimple,
  Plus,
  X,
} from 'phosphor-react-native';
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
  /// Optional second arg is a caption sent on the same message row.
  /// The composer stages the image as a pending attachment and only
  /// invokes this when the user taps Send (WhatsApp/iMessage pattern).
  onSendImage:     (localUri: string, body?: string) => Promise<void> | void;
  onSaveEdit:      (body: string) => Promise<void> | void;
  /// Opens the scheduling composer modal. When undefined, the calendar
  /// button is hidden (e.g. on screens where scheduling is disabled).
  onOpenScheduling?: () => void;
  /// Opens the when-to-meet (availability poll) composer. Independent
  /// from onOpenScheduling — that one books a specific time, this one
  /// runs a poll across a date range.
  onOpenAvailabilityPoll?: () => void;
  /// Fired on every meaningful keystroke. Caller debounces & broadcasts
  /// presence; the composer just signals intent.
  onTypingPing:    () => void;

  /// Attachment grid panel state. Owned by the parent so it can also be
  /// dismissed from outside (e.g. when the user scrolls or taps the
  /// messages list). When true, the grid renders below the input row in
  /// the keyboard's footprint (WeChat-style); the parent is expected to
  /// have already called Keyboard.dismiss() before flipping this true.
  attachMenuOpen:    boolean;
  onToggleAttachMenu: () => void;
  onCloseAttachMenu:  () => void;
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
  onOpenScheduling,
  onOpenAvailabilityPoll,
  onTypingPing,
  attachMenuOpen,
  onToggleAttachMenu,
  onCloseAttachMenu,
}: Props) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  /// Staged image: when set, a preview chip renders above the input and
  /// the next Send tap commits the image + optional caption. Cleared on
  /// successful send or when the user taps the chip's × to discard.
  const [pendingAttachment, setPendingAttachment] = useState<{ uri: string } | null>(null);
  const lastPingRef = useRef(0);

  /// Micro-animations: the plus button's background tweens between the
  /// closed-state surface tint and the open-state primary tint, and the
  /// send button's opacity tweens between disabled (no text) and active.
  /// Both fade over ~150ms so the state changes don't snap.
  const plusTint = useRef(new Animated.Value(0)).current;
  const sendActivation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(plusTint, {
      toValue: attachMenuOpen ? 1 : 0,
      duration: 180,
      easing: Easing.inOut(Easing.cubic),
      // backgroundColor / borderColor can't use the native driver.
      useNativeDriver: false,
    }).start();
  }, [attachMenuOpen, plusTint]);

  const sendEnabled = (!!text.trim() || !!pendingAttachment) && !sending;
  useEffect(() => {
    Animated.timing(sendActivation, {
      toValue: sendEnabled ? 1 : 0,
      duration: 150,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [sendEnabled, sendActivation]);

  const plusBg = plusTint.interpolate({
    inputRange:  [0, 1],
    outputRange: [Brand.surface1, Brand.primary],
  });
  const plusBorder = plusTint.interpolate({
    inputRange:  [0, 1],
    outputRange: [Brand.borderDefault, Brand.primary],
  });
  const sendOpacity = sendActivation.interpolate({
    inputRange:  [0, 1],
    outputRange: [0.4, 1],
  });

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
    if (!sendEnabled) return;
    const trimmed = text.trim();
    setSending(true);
    try {
      if (editing) {
        await onSaveEdit(trimmed);
      } else if (pendingAttachment) {
        // Send image (optionally with the typed text as a caption).
        await onSendImage(pendingAttachment.uri, trimmed || undefined);
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setPendingAttachment(null);
      } else {
        await onSendText(trimmed);
      }
      setText('');
    } finally {
      setSending(false);
    }
  };

  const pickImage = async () => {
    if (editing) return;
    onCloseAttachMenu();
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsMultipleSelection: false,
    });
    if (result.canceled || result.assets.length === 0) return;
    // Stage as a pending attachment instead of sending immediately. The
    // user reviews the thumbnail, optionally types a caption, and taps
    // Send to commit. LayoutAnimation smooths the chip's appearance.
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setPendingAttachment({ uri: result.assets[0].uri });
  };

  const clearPendingAttachment = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setPendingAttachment(null);
  };

  const handlePlusPress = () => {
    if (editing) return;
    onToggleAttachMenu();
  };

  return (
    <View style={styles.root}>
      {/* Pending attachment preview — staged image waiting for Send.
          Renders above the input row; placeholder for the future "swipe
          left to delete" pattern if multi-attachment ever lands. */}
      {pendingAttachment && !editing && (
        <View style={styles.attachmentPreviewRow}>
          <View style={styles.attachmentThumbWrap}>
            <Image
              source={{ uri: pendingAttachment.uri }}
              style={styles.attachmentThumb}
              resizeMode="cover"
            />
            <Pressable
              onPress={clearPendingAttachment}
              hitSlop={10}
              style={styles.attachmentRemoveBtn}
              accessibilityRole="button"
              accessibilityLabel="Remove attachment"
            >
              <X size={12} color={Brand.inkOnBrand} weight="bold" />
            </Pressable>
          </View>
          <Text style={styles.attachmentHint} numberOfLines={2}>
            Add a caption, or tap Send to send the photo.
          </Text>
        </View>
      )}

      {replyTo && (
        <View style={styles.banner}>
          <View style={styles.bannerBar} />
          <View style={styles.bannerText}>
            <Text style={styles.bannerTitle} numberOfLines={1}>
              Replying to {nameById[replyTo.sender_id] ?? 'them'}
            </Text>
            {replyTo.body ? (
              <Text style={styles.bannerBody} numberOfLines={1}>
                {replyTo.body}
              </Text>
            ) : replyTo.attachment_url ? (
              <View style={styles.bannerBodyRow}>
                <Paperclip size={12} color={Brand.inkMuted} weight="regular" />
                <Text style={styles.bannerBody}>Photo</Text>
              </View>
            ) : null}
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
            onPress={handlePlusPress}
            hitSlop={10}
            accessibilityLabel={attachMenuOpen ? 'Close attachments' : 'Open attachments'}
          >
            <Animated.View
              style={[
                styles.iconBtn,
                styles.plusBtn,
                { backgroundColor: plusBg, borderColor: plusBorder },
              ]}
            >
              <Plus
                size={18}
                color={attachMenuOpen ? Brand.inkOnBrand : Brand.inkMuted}
                weight="bold"
              />
            </Animated.View>
          </Pressable>
        )}

        <TextInput
          value={text}
          onChangeText={handleChange}
          onFocus={onCloseAttachMenu}
          placeholder={
            editing
              ? 'Edit message…'
              : pendingAttachment
                ? 'Add a caption…'
                : 'Message…'
          }
          placeholderTextColor={Brand.inkPlaceholder}
          multiline
          style={styles.input}
        />

        <Pressable
          onPress={submit}
          disabled={!sendEnabled}
          accessibilityLabel={editing ? 'Save edit' : 'Send'}
        >
          <Animated.View style={[styles.sendBtn, { opacity: sendOpacity }]}>
            <PaperPlaneTilt size={16} color={Brand.inkOnBrand} weight="fill" />
          </Animated.View>
        </Pressable>
      </View>

      {/* Attachment grid — WeChat pattern. Lives BELOW the input row in
          the keyboard's vacated footprint. Parent dismisses the keyboard
          before flipping attachMenuOpen=true. Photos is the only live
          action today; Camera / File / Location are dim placeholders. */}
      {attachMenuOpen && !editing && (
        <View style={styles.attachGrid}>
          <View style={styles.attachGridRow}>
            <AttachTile
              Icon={ImageSquare}
              label="Photos"
              tint={Brand.primary}
              onPress={pickImage}
            />
            {onOpenScheduling && (
              <AttachTile
                Icon={CalendarPlus}
                label="Meeting"
                tint={Brand.primary}
                onPress={() => {
                  onCloseAttachMenu();
                  onOpenScheduling();
                }}
              />
            )}
            {onOpenAvailabilityPoll && (
              <AttachTile
                Icon={Clock}
                label="My times"
                tint={Brand.primary}
                onPress={() => {
                  onCloseAttachMenu();
                  onOpenAvailabilityPoll();
                }}
              />
            )}
            <AttachTile
              Icon={Camera}
              label="Camera"
              tint={Brand.surface2}
              disabled
            />
            <AttachTile
              Icon={FileText}
              label="File"
              tint={Brand.surface2}
              disabled
            />
            <AttachTile
              Icon={MapPin}
              label="Location"
              tint={Brand.surface2}
              disabled
            />
          </View>
        </View>
      )}
    </View>
  );
}

interface AttachTileProps {
  Icon:    React.ComponentType<{ size: number; color: string; weight?: 'regular' | 'bold' | 'fill' }>;
  label:   string;
  tint:    string;
  onPress?: () => void;
  disabled?: boolean;
}

/// One tile in the attachment grid. Square card with a tinted circle
/// holding the icon, label centered underneath. Disabled tiles fade
/// to ~45% and ignore taps.
function AttachTile({ Icon, label, tint, onPress, disabled }: AttachTileProps) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.attachTile,
        disabled && styles.attachTileDisabled,
        pressed && !disabled && { opacity: 0.85 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
    >
      <View style={[styles.attachTileIcon, { backgroundColor: tint }]}>
        <Icon size={22} color={disabled ? Brand.inkMuted : Brand.inkOnBrand} weight="regular" />
      </View>
      <Text style={[styles.attachTileLabel, disabled && styles.attachTileLabelDisabled]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    // Hearth: transparent root sits over the screen's warm wash. The
    // input row provides its own glassy surface.
    backgroundColor: 'transparent',
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

  // Pending attachment preview — staged image waiting for Send.
  attachmentPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: Space.md,
    paddingVertical: 10,
    backgroundColor: Brand.surface1,
    borderTopWidth: 1,
    borderTopColor: Brand.borderDefault,
  },
  attachmentThumbWrap: {
    width: 56,
    height: 56,
    position: 'relative',
  },
  attachmentThumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
  },
  attachmentRemoveBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Brand.inkPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Brand.canvas,
  },
  attachmentHint: {
    flex: 1,
    fontFamily: AmbitFont.body,
    fontSize: 12,
    color: Brand.inkMuted,
    lineHeight: 16,
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
  bannerBodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
  // The + toggle pill. backgroundColor + borderColor are driven by an
  // Animated.Value at the JSX site so the open/close transition tweens
  // smoothly between surface1/borderDefault and primary/primary.
  plusBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 4,
  },

  // Attachment grid panel — sits BELOW the input row in the keyboard's
  // footprint. Fixed height approximates an iOS keyboard so the input
  // doesn't visually jump when toggling the menu vs. the real keyboard.
  attachGrid: {
    height: 280,
    paddingHorizontal: Space.md,
    paddingTop: 18,
    backgroundColor: Brand.hearthGlassBg,
    borderTopWidth: 1,
    borderTopColor: Brand.hearthGlassEdge,
  },
  attachGridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 14,
  },
  // Fixed quarter-width so the grid is 4-up and wraps cleanly to a second
  // row (a partial last row stays left-aligned). Horizontal spacing comes
  // from the centered content inside each cell, not a row gap — combining
  // 25% width with a gap would overflow the row.
  attachTile: {
    width: '25%',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  attachTileDisabled: { opacity: 0.45 },
  attachTileIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachTileLabel: {
    fontFamily: AmbitFont.body,
    fontSize: 12,
    fontWeight: '600',
    color: Brand.inkPrimary,
  },
  attachTileLabelDisabled: { color: Brand.inkMuted },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: Brand.hearthGlassBg,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Brand.hearthGlassEdge,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontFamily: AmbitFont.body,
    fontSize: 15,
    color: Brand.inkBody,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Brand.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 0,
  },
  // sendBtn opacity tweens via Animated.Value driven by `sendEnabled`.
});
