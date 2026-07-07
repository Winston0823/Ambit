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
import { REPORT_REASONS, reportContent, type ReportReason, type ReportTarget } from '../../lib/safety';
import { toast } from '../../lib/toast';
import { AmbitFont, Brand, Radii, Space } from '../../constants/theme';

interface Props {
  visible: boolean;
  /// What's being reported (user, and optionally a conversation/message).
  /// Null renders nothing — the sheet is target-driven.
  target: ReportTarget | null;
  onClose: () => void;
  /// Fired AFTER the report is written. Caller may follow with a block prompt.
  onReported?: (target: ReportTarget, reason: ReportReason) => void;
}

/// Bottom sheet listing report reasons. Mirrors PassReasonSheet: tapping a
/// reason files the report, toasts confirmation, and dismisses. Errors surface
/// inline and the sheet stays mounted so the user can retry.
export function ReportReasonSheet({ visible, target, onClose, onReported }: Props) {
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePick = async (reason: ReportReason) => {
    if (!target || submitting) return;
    setSubmitting(reason);
    setError(null);
    try {
      await reportContent(target, reason);
      toast.success('Thanks — our team will review this.');
      onReported?.(target, reason);
      onClose();
    } catch (e: any) {
      setError(e?.message ?? 'Could not send the report — try again.');
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>Report</Text>
            <Pressable hitSlop={10} onPress={onClose} accessibilityLabel="Close">
              <X size={18} color={Brand.inkMuted} weight="bold" />
            </Pressable>
          </View>
          <Text style={styles.subtitle}>
            Tell us what's wrong. Reports are confidential and reviewed by our team.
          </Text>

          <View style={styles.list}>
            {REPORT_REASONS.map((reason) => {
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
                  accessibilityRole="button"
                  accessibilityLabel={`Report for ${reason}`}
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
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Brand.canvas,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Space.lg,
    paddingTop: 12,
    paddingBottom: 32,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Brand.borderDefault,
    marginBottom: 16,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: AmbitFont.display, fontSize: 22, color: Brand.inkPrimary },
  subtitle: {
    fontFamily: AmbitFont.body,
    fontSize: 13,
    color: Brand.inkMuted,
    marginTop: 8,
    marginBottom: 16,
    lineHeight: 18,
  },
  list: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: Brand.surface1,
    borderRadius: Radii.md,
  },
  rowLabel: { fontFamily: AmbitFont.body, fontSize: 15, color: Brand.inkPrimary, fontWeight: '600', flex: 1 },
  error: { fontFamily: AmbitFont.body, fontSize: 13, color: Brand.danger, marginTop: 12 },
});
