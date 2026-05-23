import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { PaperPlaneTilt, X } from 'phosphor-react-native';
import * as Haptics from 'expo-haptics';
import {
  AmbitFont,
  Brand,
  Radii,
  Space,
  TypeScale,
} from '../../constants/theme';
import type { DiscoveryCardData } from '../../data/mock';

interface Props {
  /// The card the composer is targeting. Null = closed. The composer uses
  /// the card's kind + display name to personalize the placeholder
  /// ("Tell Alex what caught your eye…" vs "Tell Noah why you'd be a good fit…")
  card: DiscoveryCardData | null;
  /// Dismiss without sending. Fires when the user taps the scrim or the X.
  onDismiss: () => void;
  /// Send the message. Parent owns the actual conversation creation flow.
  onSend: (card: DiscoveryCardData, text: string) => void;
}

/// Modal composer that replaces the swipe-up gesture. Triggered by the
/// "Reach out" button pinned to the bottom of each discovery card.
///
/// Same visual contract as the prior inline composer (header + textarea +
/// warm-tan send pill), now rendered as a bottom sheet so the underlying
/// card stays still while the user types. Solves the conflict between
/// card-internal scroll and the swipe-up gesture.
export function ReachOutComposer({ card, onDismiss, onSend }: Props) {
  const [text, setText] = useState('');

  // Animated entry — fade scrim + spring the sheet up. Same idiom as
  // PortfolioModal for visual consistency.
  const scrimOpacity = useRef(new Animated.Value(0)).current;
  const sheetY       = useRef(new Animated.Value(40)).current;
  const sheetOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (card) {
      setText('');
      Animated.parallel([
        Animated.timing(scrimOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(sheetY,  { toValue: 0, friction: 8, tension: 110, useNativeDriver: true }),
        Animated.timing(sheetOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    } else {
      scrimOpacity.setValue(0);
      sheetY.setValue(40);
      sheetOpacity.setValue(0);
    }
  }, [card, scrimOpacity, sheetY, sheetOpacity]);

  if (!card) return null;

  // Personalized placeholder. Same logic as the prior inline composer —
  // first-name of the recipient, framing depends on which side initiates.
  const firstName =
    card.kind === 'seeker'
      ? card.name.split(' ')[0]
      : card.ownerName.split(' ')[0];
  const placeholder =
    card.kind === 'seeker'
      ? `Tell ${firstName} what caught your eye…`
      : `Tell ${firstName} why you'd be a good fit…`;

  const canSend = text.trim().length > 0;

  const handleDismiss = () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    onDismiss();
  };

  const handleSend = () => {
    if (!canSend) return;
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    onSend(card, text.trim());
  };

  return (
    <Modal
      transparent
      animationType="none"
      visible={!!card}
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.root}
      >
        <Animated.View style={[styles.scrimWrap, { opacity: scrimOpacity }]}>
          <Pressable style={styles.scrim} onPress={handleDismiss} />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            { opacity: sheetOpacity, transform: [{ translateY: sheetY }] },
          ]}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Say hi</Text>
            <Pressable
              onPress={handleDismiss}
              hitSlop={10}
              accessibilityLabel="Cancel"
            >
              <X size={20} color={Brand.inkMuted} weight="bold" />
            </Pressable>
          </View>

          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={placeholder}
            placeholderTextColor={Brand.inkPlaceholder}
            multiline
            autoFocus
            style={styles.input}
            maxLength={400}
          />

          <View style={styles.actions}>
            <Pressable
              onPress={handleSend}
              disabled={!canSend}
              style={({ pressed }) => [
                styles.sendBtn,
                !canSend && styles.sendBtnDisabled,
                pressed && canSend && { opacity: 0.9 },
              ]}
            >
              <PaperPlaneTilt size={16} color={Brand.inkOnBrand} weight="fill" />
              <Text style={styles.sendLabel}>Send</Text>
            </Pressable>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrimWrap: {
    ...StyleSheet.absoluteFillObject,
  },
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },

  sheet: {
    backgroundColor: Brand.canvas,
    borderTopLeftRadius: Radii.lg + 4,
    borderTopRightRadius: Radii.lg + 4,
    padding: Space.lg,
    paddingBottom: Space.lg + 8,
    gap: 14,
    // iOS shadow
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: -8 },
    shadowRadius: 24,
    // Android elevation
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: AmbitFont.display,
    fontSize: 20,
    color: Brand.inkPrimary,
  },
  input: {
    minHeight: 96,
    maxHeight: 180,
    fontFamily: AmbitFont.body,
    fontSize: 16,
    color: Brand.inkBody,
    backgroundColor: Brand.surface1,
    borderRadius: Radii.md,
    padding: 14,
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: Radii.md,
    backgroundColor: Brand.primary,
  },
  sendBtnDisabled: { opacity: 0.45 },
  sendLabel: {
    ...TypeScale.title,
    fontSize: 15,
    color: Brand.inkOnBrand,
  },
});
