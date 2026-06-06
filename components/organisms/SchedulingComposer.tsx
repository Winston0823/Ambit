import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { CalendarPlus, Plus, X } from 'phosphor-react-native';
import { buildSlot, proposeMeeting, type SchedulingSlot } from '../../lib/scheduling';
import { AmbitFont, Brand, Radii, Space } from '../../constants/theme';

interface Props {
  visible:        boolean;
  conversationId: string | null;
  defaultTitle:   string;
  onClose:        () => void;
  /// Fired after a successful propose. Caller can navigate or refresh.
  onProposed:     (requestId: string) => void;
}

const DURATIONS = [15, 30, 45, 60] as const;

/// Bottom-sheet composer for proposing 1-3 meeting slots. Each slot is
/// a single date+time pick (duration is shared across all slots). On
/// send, calls propose_meeting RPC. The calendar permission ask happens
/// later — on accept (recipient) or when tapping "Add to my calendar"
/// (proposer) — so a propose-and-cancel flow never touches the user's
/// calendar.
export function SchedulingComposer({
  visible,
  conversationId,
  defaultTitle,
  onClose,
  onProposed,
}: Props) {
  const [title, setTitle]             = useState(defaultTitle);
  const [duration, setDuration]       = useState<number>(30);
  const [slotDates, setSlotDates]     = useState<Date[]>([defaultSlotStart()]);
  const [pickerOpenIdx, setPickerOpenIdx] = useState<number | null>(null);
  const [pickerMode, setPickerMode]   = useState<'date' | 'time'>('date');
  const [sending, setSending]         = useState(false);

  // Reset state when the sheet reopens with a new conversation.
  useEffect(() => {
    if (visible) {
      setTitle(defaultTitle);
      setDuration(30);
      setSlotDates([defaultSlotStart()]);
      setPickerOpenIdx(null);
      setPickerMode('date');
    }
  }, [visible, defaultTitle]);

  const updateSlotDate = (idx: number, newDate: Date) => {
    setSlotDates((prev) => prev.map((d, i) => (i === idx ? newDate : d)));
  };

  const addSlot = () => {
    if (slotDates.length >= 3) return;
    const last = slotDates[slotDates.length - 1];
    // Default the next slot to a day after the previous one so the user
    // isn't proposing three identical times.
    const next = new Date(last.getTime() + 24 * 60 * 60 * 1000);
    setSlotDates((prev) => [...prev, next]);
  };

  const removeSlot = (idx: number) => {
    if (slotDates.length === 1) return;
    setSlotDates((prev) => prev.filter((_, i) => i !== idx));
  };

  const send = async () => {
    if (!conversationId || sending) return;
    setSending(true);
    try {
      const slots: SchedulingSlot[] = slotDates.map((d) => buildSlot(d, duration));
      const requestId = await proposeMeeting({
        conversationId,
        slots,
        title:       title.trim() || 'Quick chat',
        durationMin: duration,
      });
      onProposed(requestId);
      onClose();
    } catch (e: any) {
      Alert.alert('Could not send', e?.message ?? '');
    } finally {
      setSending(false);
    }
  };

  const dismiss = () => {
    if (sending) return;
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={dismiss}
    >
      <Pressable style={styles.backdrop} onPress={dismiss}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.headerRow}>
              <Text style={styles.title}>Propose a meeting</Text>
              <Pressable onPress={dismiss} hitSlop={10}>
                <X size={20} color={Brand.inkMuted} weight="bold" />
              </Pressable>
            </View>

            <Field label="WHAT'S IT ABOUT">
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Quick chat"
                placeholderTextColor={Brand.inkPlaceholder}
                style={styles.input}
              />
            </Field>

            <Field label="HOW LONG">
              <View style={styles.durationRow}>
                {DURATIONS.map((d) => {
                  const selected = duration === d;
                  return (
                    <Pressable
                      key={d}
                      onPress={() => setDuration(d)}
                      style={[
                        styles.durationChip,
                        selected && styles.durationChipSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.durationChipText,
                          selected && styles.durationChipTextSelected,
                        ]}
                      >
                        {d} min
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Field>

            <Field label={`PROPOSE WHEN  ·  ${slotDates.length} / 3`}>
              <View style={{ gap: 8 }}>
                {slotDates.map((d, i) => (
                  <View key={i} style={styles.slotRow}>
                    <Pressable
                      onPress={() => {
                        setPickerMode('date');
                        setPickerOpenIdx(i);
                      }}
                      style={styles.slotChip}
                    >
                      <Text style={styles.slotChipText}>{formatDate(d)}</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        setPickerMode('time');
                        setPickerOpenIdx(i);
                      }}
                      style={styles.slotChip}
                    >
                      <Text style={styles.slotChipText}>{formatTime(d)}</Text>
                    </Pressable>
                    {slotDates.length > 1 && (
                      <Pressable
                        onPress={() => removeSlot(i)}
                        hitSlop={6}
                        style={styles.removeBtn}
                        accessibilityLabel="Remove this slot"
                      >
                        <X size={14} color={Brand.inkMuted} weight="bold" />
                      </Pressable>
                    )}
                  </View>
                ))}

                {slotDates.length < 3 && (
                  <Pressable onPress={addSlot} style={styles.addBtn}>
                    <Plus size={14} color={Brand.accent} weight="bold" />
                    <Text style={styles.addBtnText}>Add another time</Text>
                  </Pressable>
                )}
              </View>
            </Field>

            <Pressable
              onPress={send}
              disabled={sending || !conversationId}
              style={[styles.sendBtn, (sending || !conversationId) && styles.sendBtnDisabled]}
            >
              <CalendarPlus size={16} color={Brand.actionInk} weight="bold" />
              <Text style={styles.sendBtnText}>
                {sending ? 'Sending…' : 'Send request'}
              </Text>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>

      {pickerOpenIdx !== null && (
        <DateTimePicker
          value={slotDates[pickerOpenIdx]}
          mode={pickerMode}
          minimumDate={new Date()}
          onChange={(event, selected) => {
            // Android: callback fires once with type 'set' or 'dismissed'
            // and the picker auto-closes. iOS spinner: fires repeatedly
            // and we close manually on user tap-away (handled elsewhere).
            if (Platform.OS === 'android') {
              setPickerOpenIdx(null);
              if (event.type === 'set' && selected) {
                updateSlotDate(pickerOpenIdx, selected);
              }
            } else if (selected) {
              updateSlotDate(pickerOpenIdx, selected);
            }
          }}
        />
      )}
      {Platform.OS === 'ios' && pickerOpenIdx !== null && (
        <Pressable style={styles.iosPickerDoneOverlay} onPress={() => setPickerOpenIdx(null)}>
          <View style={styles.iosPickerDoneBtn}>
            <Text style={styles.iosPickerDoneText}>Done</Text>
          </View>
        </Pressable>
      )}
    </Modal>
  );
}

function defaultSlotStart(): Date {
  // Round up to the next half-hour at least 1 hour out.
  const d = new Date();
  d.setHours(d.getHours() + 1);
  const mins = d.getMinutes();
  d.setMinutes(mins < 30 ? 30 : 60, 0, 0);
  return d;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString(undefined, {
    hour: 'numeric', minute: '2-digit',
  });
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Brand.canvas,
    borderTopLeftRadius: Radii.lg,
    borderTopRightRadius: Radii.lg,
    paddingTop: Space.md,
    paddingBottom: 36,
    paddingHorizontal: Space.lg,
    gap: Space.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: AmbitFont.display,
    fontSize: 22,
    color: Brand.inkPrimary,
  },

  field: { gap: 8 },
  label: {
    fontFamily: AmbitFont.body,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: Brand.inkLabel,
  },
  input: {
    height: 44,
    borderRadius: Radii.md,
    paddingHorizontal: 14,
    backgroundColor: Brand.surface1,
    borderWidth: 1.5,
    borderColor: Brand.borderDefault,
    fontFamily: AmbitFont.body,
    fontSize: 14,
    color: Brand.inkBody,
  },

  durationRow: { flexDirection: 'row', gap: 8 },
  durationChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radii.pill,
    backgroundColor: Brand.surface1,
    borderWidth: 1.5,
    borderColor: Brand.borderDefault,
  },
  durationChipSelected: {
    backgroundColor: Brand.action,
    borderColor: Brand.actionInk,
  },
  durationChipText: {
    fontFamily: AmbitFont.body,
    fontSize: 13,
    color: Brand.inkBody,
  },
  durationChipTextSelected: { color: Brand.actionInk, fontWeight: '700' },

  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  slotChip: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: Radii.md,
    backgroundColor: Brand.surface1,
    borderWidth: 1.5,
    borderColor: Brand.borderDefault,
  },
  slotChipText: {
    fontFamily: AmbitFont.body,
    fontSize: 14,
    color: Brand.inkBody,
    fontWeight: '600',
  },
  removeBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: Radii.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Brand.borderDefault,
  },
  addBtnText: {
    fontFamily: AmbitFont.body,
    fontSize: 13,
    color: Brand.inkBody,
    fontWeight: '600',
  },

  sendBtn: {
    marginTop: Space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: Brand.action,
    borderWidth: 1.6,
    borderColor: Brand.actionInk,
    shadowColor: Brand.actionInk,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 4 },
    elevation: 0,
  },
  sendBtnDisabled: { opacity: 0.45 },
  sendBtnText: {
    fontFamily: AmbitFont.body,
    fontSize: 15,
    fontWeight: '700',
    color: Brand.actionInk,
  },

  iosPickerDoneOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'flex-end',
    paddingHorizontal: Space.lg,
    paddingVertical: 8,
    backgroundColor: Brand.canvas,
  },
  iosPickerDoneBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  iosPickerDoneText: {
    fontFamily: AmbitFont.body,
    fontSize: 16,
    fontWeight: '600',
    color: Brand.inkBody,
  },
});
