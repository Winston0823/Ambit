import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { CalendarPlus, Check, Plus, X } from 'phosphor-react-native';
import { buildSlot, proposeMeeting, type SchedulingSlot } from '../../lib/scheduling';
import { HardShadow } from '../atoms';
import {
  formatCellLabel,
  listAvailabilityPolls,
  listAvailabilityResponses,
  overlapCellKeys,
  selectedCellKeys,
} from '../../lib/availability';
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

/// Bottom-sheet composer for proposing 1-3 meeting slots.
///
/// If the conversation has an open availability poll where both users
/// have responded, the "PROPOSE WHEN" section shows the overlapping
/// slots as selectable chips (up to 3). The user can still tap
/// "or pick a different time" to switch to the free-form date picker.
///
/// If there is no poll / only one user has responded / no overlap, the
/// composer falls straight through to the existing date+time picker.
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
  const [sending, setSending]         = useState(false);

  // ── Availability overlap state ────────────────────────────────────
  /// Dates derived from the intersection of both users' availability.
  const [overlapDates, setOverlapDates]   = useState<Date[]>([]);
  /// Duration from the poll — pre-fills the duration picker.
  const [pollDuration, setPollDuration]   = useState<number | null>(null);
  /// Whether we're showing the overlap chip list (true) or the
  /// free-form date picker (false).
  const [useOverlapMode, setUseOverlapMode] = useState(false);
  /// Keys of the overlap chips the user has selected.
  const [selectedKeys, setSelectedKeys]   = useState<Set<string>>(new Set());

  // Reset UI state when the sheet reopens.
  useEffect(() => {
    if (visible) {
      setTitle(defaultTitle);
      setDuration(30);
      setSlotDates([defaultSlotStart()]);
      setPickerOpenIdx(null);
      setOverlapDates([]);
      setPollDuration(null);
      setUseOverlapMode(false);
      setSelectedKeys(new Set());
    }
  }, [visible, defaultTitle]);

  // Fetch availability overlap when the sheet opens.
  useEffect(() => {
    if (!visible || !conversationId) return;
    let cancelled = false;

    (async () => {
      try {
        const polls = await listAvailabilityPolls(conversationId);
        // Most-recent open poll wins.
        const openPoll = [...polls].reverse().find((p) => p.status === 'open');
        if (!openPoll || cancelled) return;

        const responses = await listAvailabilityResponses(openPoll.id);
        if (cancelled) return;

        // Need responses from both participants.
        const r1 = responses.find((r) => r.user_id === openPoll.proposer_id);
        const r2 = responses.find((r) => r.user_id === openPoll.recipient_id);
        if (!r1 || !r2) return;

        const keys1 = selectedCellKeys(r1.selected_slots);
        const keys2 = selectedCellKeys(r2.selected_slots);
        const overlapKeyList = overlapCellKeys(keys1, keys2);
        if (overlapKeyList.length === 0) return;

        const dates = overlapKeyList.map((k) => new Date(k));
        if (!cancelled) {
          setOverlapDates(dates);
          setPollDuration(openPoll.duration_min);
          setDuration(openPoll.duration_min);
          setUseOverlapMode(true);
          // Pre-select the first 3 overlap slots so the user can send
          // immediately without having to tap anything.
          setSelectedKeys(new Set(overlapKeyList.slice(0, 3)));
        }
      } catch (e) {
        // Non-fatal — fall back to free-form picker silently.
        console.warn('SchedulingComposer: could not load availability overlap:', e);
      }
    })();

    return () => { cancelled = true; };
  }, [visible, conversationId]);

  const toggleOverlapSlot = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else if (next.size < 3) {
        next.add(key);
      }
      return next;
    });
  };

  const updateSlotDate = (idx: number, newDate: Date) => {
    setSlotDates((prev) => prev.map((d, i) => (i === idx ? newDate : d)));
  };

  const addSlot = () => {
    if (slotDates.length >= 3) return;
    const last = slotDates[slotDates.length - 1];
    setSlotDates((prev) => [...prev, new Date(last.getTime() + 24 * 60 * 60 * 1000)]);
  };

  const removeSlot = (idx: number) => {
    if (slotDates.length === 1) return;
    setSlotDates((prev) => prev.filter((_, i) => i !== idx));
  };

  const canSend = useOverlapMode
    ? selectedKeys.size > 0
    : slotDates.length > 0;

  const send = async () => {
    if (!conversationId || sending || !canSend) return;
    setSending(true);
    try {
      let slots: SchedulingSlot[];
      const effectiveDuration = pollDuration ?? duration;

      if (useOverlapMode && selectedKeys.size > 0) {
        slots = Array.from(selectedKeys).map((key) => buildSlot(new Date(key), effectiveDuration));
      } else {
        slots = slotDates.map((d) => buildSlot(d, duration));
      }

      const requestId = await proposeMeeting({
        conversationId,
        slots,
        title:       title.trim() || 'Quick chat',
        durationMin: effectiveDuration,
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
                      style={[styles.durationChip, selected && styles.durationChipSelected]}
                    >
                      <Text style={[styles.durationChipText, selected && styles.durationChipTextSelected]}>
                        {d} min
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Field>

            {useOverlapMode ? (
              // ── Overlap mode: both users have filled out availability ──
              <Field label={`RECOMMENDED TIMES  ·  ${selectedKeys.size} / 3 selected`}>
                <Text style={styles.overlapHint}>
                  These slots work for both of you. Tap to deselect.
                </Text>
                <ScrollView
                  style={styles.overlapList}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  {overlapDates.map((d) => {
                    const key = d.toISOString();
                    const isSelected = selectedKeys.has(key);
                    const atLimit = selectedKeys.size >= 3 && !isSelected;
                    return (
                      <Pressable
                        key={key}
                        onPress={() => !atLimit && toggleOverlapSlot(key)}
                        style={[
                          styles.overlapChip,
                          isSelected && styles.overlapChipSelected,
                          atLimit && styles.overlapChipDisabled,
                        ]}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: isSelected, disabled: atLimit }}
                      >
                        <Text style={[styles.overlapChipText, isSelected && styles.overlapChipTextSelected]}>
                          {formatCellLabel(d)}
                        </Text>
                        {isSelected && (
                          <Check size={14} color={Brand.actionInk} weight="bold" />
                        )}
                      </Pressable>
                    );
                  })}
                </ScrollView>
                <Pressable onPress={() => setUseOverlapMode(false)} style={styles.switchModeBtn}>
                  <Text style={styles.switchModeText}>or pick a different time</Text>
                </Pressable>
              </Field>
            ) : (
              // ── Free-form mode: single combined chip → bottom-sheet picker
              <Field label={`PROPOSE WHEN  ·  ${slotDates.length} / 3`}>
                <View style={{ gap: 8 }}>
                  {slotDates.map((d, i) => (
                    <View key={i} style={styles.slotRow}>
                      <Pressable
                        onPress={() => setPickerOpenIdx(i)}
                        style={[styles.slotChip, styles.slotChipCombined]}
                      >
                        <Text style={styles.slotChipText}>
                          {formatDate(d)}  ·  {formatTime(d)}
                        </Text>
                      </Pressable>
                      {slotDates.length > 1 && (
                        <Pressable onPress={() => removeSlot(i)} hitSlop={6} style={styles.removeBtn}>
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

                  {overlapDates.length > 0 && (
                    <Pressable onPress={() => setUseOverlapMode(true)} style={styles.switchModeBtn}>
                      <Text style={styles.switchModeText}>
                        ← Use matching times from availability poll
                      </Text>
                    </Pressable>
                  )}
                </View>
              </Field>
            )}

            <HardShadow radius={999} offset={4} style={styles.sendBtnShadow}>
              <Pressable
                onPress={send}
                disabled={sending || !conversationId || !canSend}
                style={[styles.sendBtn, (sending || !conversationId || !canSend) && styles.sendBtnDisabled]}
              >
                <CalendarPlus size={16} color={Brand.actionInk} weight="bold" />
                <Text style={styles.sendBtnText}>
                  {sending ? 'Sending…' : 'Send request'}
                </Text>
              </Pressable>
            </HardShadow>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>

      <SlotPickerSheet
        visible={pickerOpenIdx !== null}
        value={pickerOpenIdx !== null ? slotDates[pickerOpenIdx] : new Date()}
        onConfirm={(d) => {
          if (pickerOpenIdx !== null) updateSlotDate(pickerOpenIdx, d);
          setPickerOpenIdx(null);
        }}
        onClose={() => setPickerOpenIdx(null)}
      />
    </Modal>
  );
}

/// Bottom-sheet popup for picking date + time for a single slot.
/// iOS: shows a single inline datetime spinner (no extra taps).
/// Android: two-step — date dialog then time dialog.
function SlotPickerSheet({
  visible,
  value,
  onConfirm,
  onClose,
}: {
  visible:   boolean;
  value:     Date;
  onConfirm: (d: Date) => void;
  onClose:   () => void;
}) {
  const [draft, setDraft]             = useState<Date>(value);
  const [androidStep, setAndroidStep] = useState<'date' | 'time'>('date');

  // Sync draft to the incoming value whenever the sheet opens.
  useEffect(() => {
    if (visible) {
      setDraft(value);
      setAndroidStep('date');
    }
  }, [visible]);

  if (!visible) return null;

  // ── Android: modal dialogs chained date → time ───────────────────
  if (Platform.OS === 'android') {
    return (
      <DateTimePicker
        value={draft}
        mode={androidStep}
        minimumDate={new Date()}
        onChange={(event, selected) => {
          if (event.type !== 'set' || !selected) {
            onClose();
            return;
          }
          if (androidStep === 'date') {
            // Keep the existing time, update only the date portion.
            const next = new Date(selected);
            next.setHours(draft.getHours(), draft.getMinutes(), 0, 0);
            setDraft(next);
            setAndroidStep('time');
          } else {
            // Keep the date, update time portion.
            const next = new Date(draft);
            next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
            onConfirm(next);
          }
        }}
      />
    );
  }

  // ── iOS: bottom sheet with inline datetime spinner ────────────────
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={pickerStyles.backdrop} onPress={() => { onConfirm(draft); onClose(); }}>
        <Pressable style={pickerStyles.sheet} onPress={() => {}}>
          <View style={pickerStyles.handle} />
          <View style={pickerStyles.header}>
            <Pressable onPress={onClose} hitSlop={10}>
              <Text style={pickerStyles.cancel}>Cancel</Text>
            </Pressable>
            <Text style={pickerStyles.title}>Date & Time</Text>
            <Pressable onPress={() => { onConfirm(draft); onClose(); }} hitSlop={10}>
              <Text style={pickerStyles.done}>Done</Text>
            </Pressable>
          </View>
          <DateTimePicker
            value={draft}
            mode="datetime"
            display="spinner"
            minimumDate={new Date()}
            onChange={(_event, selected) => { if (selected) setDraft(selected); }}
            style={pickerStyles.spinner}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const pickerStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Brand.canvas,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 36,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Brand.borderDefault,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Brand.borderDefault,
  },
  title: {
    fontFamily: AmbitFont.body,
    fontSize: 15,
    fontWeight: '600',
    color: Brand.inkPrimary,
  },
  cancel: {
    fontFamily: AmbitFont.body,
    fontSize: 15,
    color: Brand.inkMuted,
  },
  done: {
    fontFamily: AmbitFont.body,
    fontSize: 15,
    fontWeight: '700',
    color: Brand.accent,
  },
  spinner: {
    width: '100%',
  },
});

function defaultSlotStart(): Date {
  const d = new Date();
  d.setHours(d.getHours() + 1);
  const mins = d.getMinutes();
  d.setMinutes(mins < 30 ? 30 : 60, 0, 0);
  return d;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
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
    paddingHorizontal: 16,
    backgroundColor: Brand.surface1,
    borderWidth: 1.5,
    borderColor: Brand.borderDefault,
    fontFamily: AmbitFont.body,
    fontSize: 14,
    color: Brand.inkBody,
  },

  durationRow: { flexDirection: 'row', gap: 8 },
  durationChip: {
    paddingHorizontal: 16,
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

  // ── Overlap chips ─────────────────────────────────────────────────
  overlapHint: {
    fontFamily: AmbitFont.body,
    fontSize: 12,
    color: Brand.inkMuted,
    marginBottom: 6,
  },
  overlapList: { maxHeight: 180 },
  overlapChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: Radii.md,
    backgroundColor: Brand.surface1,
    borderWidth: 1.5,
    borderColor: Brand.borderDefault,
    marginBottom: 6,
  },
  overlapChipSelected: {
    backgroundColor: Brand.action,
    borderColor: Brand.actionInk,
  },
  overlapChipDisabled: { opacity: 0.4 },
  overlapChipText: {
    fontFamily: AmbitFont.body,
    fontSize: 14,
    color: Brand.inkBody,
    fontWeight: '600',
  },
  overlapChipTextSelected: { color: Brand.actionInk },

  switchModeBtn: { alignSelf: 'flex-start', marginTop: 2 },
  switchModeText: {
    fontFamily: AmbitFont.body,
    fontSize: 13,
    color: Brand.inkMuted,
    textDecorationLine: 'underline',
  },

  // ── Free-form slots ───────────────────────────────────────────────
  slotRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  slotChip: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: Radii.md,
    backgroundColor: Brand.surface1,
    borderWidth: 1.5,
    borderColor: Brand.borderDefault,
  },
  slotChipCombined: {
    // Slightly taller so the combined date · time reads comfortably.
    paddingVertical: 13,
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
    gap: 8,
    paddingVertical: 12,
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

  // ── Send ─────────────────────────────────────────────────────────
  sendBtnShadow: {
    marginTop: Space.sm,
  },
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 999,
    backgroundColor: Brand.action,
    borderWidth: 1.6,
    borderColor: Brand.actionInk,
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
    paddingVertical: 8,
  },
  iosPickerDoneText: {
    fontFamily: AmbitFont.body,
    fontSize: 16,
    fontWeight: '600',
    color: Brand.inkBody,
  },
});
