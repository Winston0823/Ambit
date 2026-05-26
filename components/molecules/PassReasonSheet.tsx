import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CaretRight, X } from 'phosphor-react-native';
import { PASS_REASONS, passConversation, type PassReason } from '../../lib/closureLoop';
import { AmbitFont, Brand, Radii, Space } from '../../constants/theme';

interface Props {
  visible:          boolean;
  conversationId:   string | null;
  onClose:          () => void;
  /// Fired AFTER the pass has been written to the server. Caller
  /// typically uses this to remove the row from the inbox / pop the
  /// thread, refetch matches, etc.
  onPassed?:        (conversationId: string, reason: PassReason | string) => void;
}

/// Bottom sheet that lists the canonical closure-loop pass reasons.
/// Tapping a reason fires `passConversation` and dismisses. Errors are
/// surfaced inline; the sheet stays mounted on failure so the user
/// can retry without re-opening.
export function PassReasonSheet({ visible, conversationId, onClose, onPassed }: Props) {
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePick = async (reason: PassReason) => {
    if (!conversationId || submitting) return;
    setSubmitting(reason);
    setError(null);
    try {
      await passConversation(conversationId, reason);
      onPassed?.(conversationId, reason);
      onClose();
    } catch (e: any) {
      setError(e?.message ?? 'Could not pass — try again.');
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Inner press is a no-op to swallow taps inside the sheet itself */}
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>Pass with a reason</Text>
            <Pressable hitSlop={10} onPress={onClose} accessibilityLabel="Close">
              <X size={18} color={Brand.inkMuted} weight="bold" />
            </Pressable>
          </View>
          <Text style={styles.subtitle}>
            The other side sees this as constructive feedback, not silence.
          </Text>

          <View style={styles.list}>
            {PASS_REASONS.map((reason) => {
              const isLoading = submitting === reason;
              return (
                <Pressable
                  key={reason}
                  onPress={() => handlePick(reason)}
                  disabled={!!submitting}
                  style={({ pressed }) => [
                    styles.row,
                    pressed && { opacity: 0.85 },
                    !!submitting && submitting !== reason && { opacity: 0.5 },
                  ]}
                >
                  <Text style={styles.rowLabel}>{reason}</Text>
                  {isLoading ? (
                    <ActivityIndicator color={Brand.accent} />
                  ) : (
                    <CaretRight size={16} color={Brand.inkLabel} weight="regular" />
                  )}
                </Pressable>
              );
            })}
          </View>

          {error && <Text style={styles.error}>{error}</Text>}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Brand.canvas,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Space.lg,
    paddingTop: 10,
    paddingBottom: 32,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Brand.borderDefault,
    marginBottom: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: AmbitFont.display,
    fontSize: 22,
    color: Brand.inkPrimary,
  },
  subtitle: {
    fontFamily: AmbitFont.body,
    fontSize: 13,
    color: Brand.inkMuted,
    marginTop: 6,
    marginBottom: 14,
    lineHeight: 18,
  },
  list: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: Brand.surface1,
    borderRadius: Radii.md,
  },
  rowLabel: {
    fontFamily: AmbitFont.body,
    fontSize: 15,
    color: Brand.inkPrimary,
    fontWeight: '600',
    flex: 1,
  },
  error: {
    fontFamily: AmbitFont.body,
    fontSize: 13,
    color: '#C0392B',
    marginTop: 10,
  },
});

