import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
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
  Clock,
  ImageSquare,
  Images,
  PaperPlaneTilt,
  Paperclip,
  PencilSimple,
  Plus,
  X,
} from 'phosphor-react-native';
import type { MessageRow } from '../../lib/messaging';
import { HardShadow } from '../atoms';
import { AmbitFont, Brand, Radii, Space } from '../../constants/theme';
import { Motion } from '../../constants/motion';

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
  /// Opens the portfolio-highlight picker so the user can share one of their
  /// own highlights into the thread. Hidden when undefined.
  onOpenPortfolio?: () => void;
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
  onOpenPortfolio,
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

  /// Send button opacity tweens between disabled (no text) and active over
  /// ~150ms so the state change doesn't snap.
  const sendActivation = useRef(new Animated.Value(0)).current;

  const sendEnabled = (!!text.trim() || !!pendingAttachment) && !sending;
  useEffect(() => {
    // Spring (soft overshoot) so the send button pops in when there's
    // something to send — the shared motion language.
    Animated.spring(sendActivation, {
      toValue: sendEnabled ? 1 : 0,
      ...Motion.spring,
      useNativeDriver: true,
    }).start();
  }, [sendEnabled, sendActivation]);

  const sendOpacity = sendActivation.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] });
  const sendScale   = sendActivation.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });

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

      <HardShadow radius={26} offset={4} style={styles.inputRowShadow}>
      <View style={styles.inputRow}>
        {!editing && (
          <Pressable
            onPress={handlePlusPress}
            hitSlop={10}
            style={styles.plusBtn}
            accessibilityLabel={attachMenuOpen ? 'Close attachments' : 'Open attachments'}
          >
            <Plus
              size={22}
              color={attachMenuOpen ? Brand.inkPrimary : Brand.inkBody}
              weight="bold"
            />
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
          <Animated.View style={[styles.sendBtn, { opacity: sendOpacity, transform: [{ scale: sendScale }] }]}>
            <PaperPlaneTilt size={16} color={Brand.actionInk} weight="fill" />
          </Animated.View>
        </Pressable>
      </View>
      </HardShadow>

      {/* Attachment grid — WeChat pattern. Lives BELOW the input row in
          the keyboard's vacated footprint. Parent dismisses the keyboard
          before flipping attachMenuOpen=true. Order follows the natural flow:
          Photos, then Find a time (pick when you're both free) → Propose time
          (offer a slot), then Highlight. */}
      {attachMenuOpen && !editing && (
        <View style={styles.attachGrid}>
          <View style={styles.attachGridRow}>
            <AttachTile
              Icon={ImageSquare}
              label="Photos"
              onPress={pickImage}
            />
            {onOpenAvailabilityPoll && (
              <AttachTile
                Icon={Clock}
                label="Find a time"
                onPress={() => {
                  onCloseAttachMenu();
                  onOpenAvailabilityPoll();
                }}
              />
            )}
            {onOpenScheduling && (
              <AttachTile
                Icon={CalendarPlus}
                label="Propose time"
                onPress={() => {
                  onCloseAttachMenu();
                  onOpenScheduling();
                }}
              />
            )}
            {onOpenPortfolio && (
              <AttachTile
                Icon={Images}
                label="Highlight"
                onPress={() => {
                  onCloseAttachMenu();
                  onOpenPortfolio();
                }}
              />
            )}
          </View>
        </View>
      )}
    </View>
  );
}

interface AttachTileProps {
  Icon:    React.ComponentType<{ size: number; color: string; weight?: 'regular' | 'bold' | 'fill' }>;
  label:   string;
  onPress?: () => void;
  disabled?: boolean;
}

/// One tile in the attachment grid. The icon is the action's primary signal,
/// so it gets a large tactile tile in the app's button language — teal `action`
/// fill, ink border, hard offset edge — with the label quiet underneath.
/// Disabled tiles fade to ~45% and ignore taps.
function AttachTile({ Icon, label, onPress, disabled }: AttachTileProps) {
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
      <HardShadow radius={Radii.lg} offset={4}>
        <View style={styles.attachTileIcon}>
          <Icon size={32} color={disabled ? Brand.inkMuted : Brand.actionInk} weight="regular" />
        </View>
      </HardShadow>
      <Text style={[styles.attachTileLabel, disabled && styles.attachTileLabelDisabled]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    // Transparent root sits over the eggshell canvas. The input row
    // provides its own cream island surface.
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
    paddingVertical: 12,
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

  // Floating cream pill that holds the +, input, and send. Crisp ink
  // border + the hard offset edge (HardShadow wrapper) — the locked
  // tactile language, replacing the old soft shadow.
  inputRowShadow: {
    marginHorizontal: Space.md,
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 8,
    backgroundColor: Brand.cardCream,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: Brand.inkEdge,
  },
  // Bare + tap target (no chip) — a clean tan glyph that darkens when the
  // attachment grid is open.
  plusBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },

  // Attachment grid panel — sits BELOW the input row in the keyboard's
  // footprint. Fixed height approximates an iOS keyboard so the input
  // doesn't visually jump when toggling the menu vs. the real keyboard.
  attachGrid: {
    height: 280,
    paddingHorizontal: Space.md,
    paddingTop: 20,
    backgroundColor: Brand.cardCream,
    borderTopWidth: 1.5,
    borderTopColor: Brand.inkEdge,
  },
  attachGridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 16,
  },
  // Fixed quarter-width so the grid is 4-up and wraps cleanly to a second
  // row (a partial last row stays left-aligned). Horizontal spacing comes
  // from the centered content inside each cell, not a row gap — combining
  // 25% width with a gap would overflow the row.
  attachTile: {
    width: '25%',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  attachTileDisabled: { opacity: 0.45 },
  // Large tactile tile — the icon is the action's main signal. App button
  // language: teal `action` fill, 1.5px ink border, hard offset edge (the
  // <HardShadow> wrapper). Radius on the 4px grid (Radii.lg).
  attachTileIcon: {
    width: 64,
    height: 64,
    borderRadius: Radii.lg,
    backgroundColor: Brand.action,
    borderWidth: 1.5,
    borderColor: Brand.inkEdge,
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
  // Transparent — the surrounding pill provides the surface now.
  input: {
    flex: 1,
    minHeight: 38,
    maxHeight: 120,
    paddingHorizontal: 8,
    paddingVertical: 8,
    fontFamily: AmbitFont.body,
    fontSize: 15,
    color: Brand.inkBody,
  },
  // Solid espresso send — the one dark action in the pill.
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Brand.action,
    borderWidth: 1.6,
    borderColor: Brand.actionInk,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // sendBtn opacity tweens via Animated.Value driven by `sendEnabled`.
});
