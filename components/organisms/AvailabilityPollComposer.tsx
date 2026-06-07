import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { CalendarPlus, X } from 'phosphor-react-native';
import {
  buildGrid,
  busyCellKeys,
  createAvailabilityPoll,
  deviceTimezone,
  formatISODate,
  todayISODate,
  type AvailabilityPollRow,
} from '../../lib/availability';
import { getBusyEvents } from '../../lib/deviceCalendar';
import { AvailabilityGrid } from '../molecules/AvailabilityGrid';
import { AmbitFont, Brand, Radii, Space } from '../../constants/theme';
import { HardShadow } from '../atoms';

interface Props {
  visible:        boolean;
  conversationId: string | null;
  defaultTitle:   string;
  onClose:        () => void;
  onProposed:     (pollId: string) => void;
}

const DURATIONS = [15, 30, 45, 60] as const;
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => i);

/// When2meet flow — opens directly into the marking grid with sensible
/// defaults (today through +4 days, 9am–9pm, 30-min cells). The Setup
/// screen still exists for advanced edits (date range, hours, duration)
/// and is reachable from the grid header. On Send, posts both the poll
/// and the proposer's initial response in one RPC.
///
/// Previously this modal opened to a Setup screen that visually
/// duplicated the SchedulingComposer (date pickers, duration), forcing
/// the user through two near-identical screens before they could mark
/// any times. Now the grid is the primary surface; setup is the detour.
export function AvailabilityPollComposer({
  visible,
  conversationId,
  defaultTitle,
  onClose,
  onProposed,
}: Props) {
  const insets = useSafeAreaInsets();
  // Default to 'mark' so the grid is the first thing the user sees.
  // 'setup' is reachable from the grid header for advanced edits.
  const [step, setStep]                 = useState<'setup' | 'mark'>('mark');
  const [title, setTitle]               = useState(defaultTitle);
  const [duration, setDuration]         = useState<number>(30);
  const [startDate, setStartDate]       = useState<string>(todayISODate());
  const [endDate, setEndDate]           = useState<string>(addDays(todayISODate(), 4));
  const [dayStartHour, setDayStartHour] = useState<number>(9);
  const [dayEndHour, setDayEndHour]     = useState<number>(21);
  const [mineKeys, setMineKeys]         = useState<Set<string>>(new Set());
  const [busyKeys, setBusyKeys]         = useState<Set<string>>(new Set());
  const [pickerOpen, setPickerOpen]     = useState<'start' | 'end' | null>(null);
  const [loadingBusy, setLoadingBusy]   = useState(false);
  const [posting, setPosting]           = useState(false);

  useEffect(() => {
    if (visible) {
      setStep('mark');
      setTitle(defaultTitle);
      setDuration(30);
      setStartDate(todayISODate());
      setEndDate(addDays(todayISODate(), 4));
      setDayStartHour(9);
      setDayEndHour(21);
      setMineKeys(new Set());
      setBusyKeys(new Set());
      setPickerOpen(null);
    }
  }, [visible, defaultTitle]);

  const tz = deviceTimezone();

  // Synthesize a minimal poll row to drive the grid in mark mode.
  const fakePoll = useMemo<AvailabilityPollRow>(
    () => ({
      id:                            'preview',
      conversation_id:               conversationId ?? '',
      proposer_id:                   '',
      recipient_id:                  '',
      title,
      duration_min:                  duration,
      start_date:                    startDate,
      end_date:                      endDate,
      day_start_hour:                dayStartHour,
      day_end_hour:                  dayEndHour,
      tz,
      status:                        'open',
      settled_scheduling_request_id: null,
      created_at:                    '',
      updated_at:                    '',
    }),
    [title, duration, startDate, endDate, dayStartHour, dayEndHour, tz, conversationId],
  );

  const cells = useMemo(() => buildGrid(fakePoll), [fakePoll]);

  // Load proposer's busy events for the window when entering mark mode.
  useEffect(() => {
    if (step !== 'mark') return;
    let cancelled = false;
    (async () => {
      setLoadingBusy(true);
      try {
        const start = parseISODate(startDate);
        const end   = parseISODate(endDate);
        end.setHours(23, 59, 59, 999);
        const events = await getBusyEvents(start, end);
        if (cancelled) return;
        setBusyKeys(busyCellKeys(cells, events));
      } finally {
        if (!cancelled) setLoadingBusy(false);
      }
    })();
    return () => { cancelled = true; };
  }, [step, startDate, endDate, cells]);

  const toggleCell = (key: string) => {
    setMineKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const proceedToMark = () => {
    if (!isValidRange(startDate, endDate)) {
      Alert.alert('Pick a valid range', 'End date must be on or after start date.');
      return;
    }
    if (daysBetween(startDate, endDate) > 5) {
      Alert.alert('Range too long', 'Pick a window of 6 days or fewer.');
      return;
    }
    if (dayEndHour <= dayStartHour) {
      Alert.alert('Invalid hours', 'End hour must be after start hour.');
      return;
    }
    setStep('mark');
  };

  const post = async () => {
    if (!conversationId || posting) return;
    if (mineKeys.size === 0) {
      Alert.alert(
        'Mark some times first',
        'Tap the times you can do so they appear for the other person.',
      );
      return;
    }
    setPosting(true);
    try {
      const proposerSlots = Array.from(mineKeys).map((key) => {
        const start = new Date(key);
        const end   = new Date(start.getTime() + duration * 60_000);
        return { start: start.toISOString(), end: end.toISOString() };
      });
      const pollId = await createAvailabilityPoll({
        conversationId,
        title:       title.trim() || 'When can we meet?',
        durationMin: duration,
        startDate,
        endDate,
        dayStartHour,
        dayEndHour,
        tz,
        proposerSlots,
      });
      onProposed(pollId);
      onClose();
    } catch (e: any) {
      Alert.alert('Could not post', e?.message ?? '');
    } finally {
      setPosting(false);
    }
  };

  const dismiss = () => {
    if (posting) return;
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={dismiss}>
      <View style={styles.root}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={dismiss} hitSlop={10}>
            <X size={22} color={Brand.inkPrimary} weight="bold" />
          </Pressable>
          <Text style={styles.title}>
            {step === 'setup' ? 'New availability poll' : 'Mark your times'}
          </Text>
          <View style={{ width: 22 }} />
        </View>

        {step === 'setup' ? (
          <ScrollView
            contentContainerStyle={styles.setupBody}
            keyboardShouldPersistTaps="handled"
          >
            <Field label="WHAT'S IT ABOUT">
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="When can we meet?"
                placeholderTextColor={Brand.inkPlaceholder}
                style={styles.input}
              />
            </Field>

            <Field label="DATE RANGE  ·  UP TO 5 DAYS">
              <View style={styles.row}>
                <Pressable
                  onPress={() => setPickerOpen('start')}
                  style={styles.dateChip}
                >
                  <Text style={styles.dateChipLabel}>Start</Text>
                  <Text style={styles.dateChipValue}>{formatHuman(startDate)}</Text>
                </Pressable>
                <Pressable
                  onPress={() => setPickerOpen('end')}
                  style={styles.dateChip}
                >
                  <Text style={styles.dateChipLabel}>End</Text>
                  <Text style={styles.dateChipValue}>{formatHuman(endDate)}</Text>
                </Pressable>
              </View>
            </Field>

            <Field label="HOURS OF THE DAY">
              <View style={styles.row}>
                <HourPicker
                  label="From"
                  value={dayStartHour}
                  onChange={setDayStartHour}
                  options={HOUR_OPTIONS.slice(0, 23)}
                />
                <HourPicker
                  label="To"
                  value={dayEndHour}
                  onChange={setDayEndHour}
                  options={HOUR_OPTIONS.slice(dayStartHour + 1).concat(24)}
                />
              </View>
            </Field>

            <Field label="SLOT LENGTH">
              <View style={styles.row}>
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
                      <Text style={[
                        styles.durationChipText,
                        selected && styles.durationChipTextSelected,
                      ]}>
                        {d} min
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Field>

            <HardShadow radius={999} offset={4}>
              <Pressable onPress={proceedToMark} style={styles.primaryBtn}>
                <Text style={styles.primaryBtnText}>Continue</Text>
              </Pressable>
            </HardShadow>
          </ScrollView>
        ) : (
          <View style={{ flex: 1 }}>
            <View style={styles.markHint}>
              <Text style={styles.markHintText}>
                Tap the times you're free. Gray cells are blocked by events on your calendar.
              </Text>
              <Pressable
                onPress={() => setStep('setup')}
                hitSlop={6}
                accessibilityLabel="Adjust window"
              >
                <Text style={styles.markHintLink}>Window…</Text>
              </Pressable>
            </View>

            {loadingBusy ? (
              <View style={styles.busyLoader}>
                <ActivityIndicator color={Brand.accent} />
              </View>
            ) : null}

            <View style={{ flex: 1, paddingHorizontal: Space.md }}>
              <AvailabilityGrid
                cells={cells}
                mySelected={mineKeys}
                theirSelected={new Set()}
                busy={busyKeys}
                editable={true}
                onToggle={toggleCell}
              />
            </View>

            <View style={styles.footer}>
              <Pressable
                onPress={onClose}
                disabled={posting}
                style={styles.secondaryBtn}
              >
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </Pressable>
              <HardShadow radius={999} offset={4} style={posting ? { opacity: 0.5 } : undefined}>
                <Pressable
                  onPress={post}
                  disabled={posting}
                  style={styles.primaryBtn}
                >
                  <CalendarPlus size={16} color={Brand.actionInk} weight="bold" />
                  <Text style={styles.primaryBtnText}>
                    {posting ? 'Posting…' : `Post poll  ·  ${mineKeys.size}`}
                  </Text>
                </Pressable>
              </HardShadow>
            </View>
          </View>
        )}

        {pickerOpen !== null && (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <DateTimePicker
              value={parseISODate(pickerOpen === 'start' ? startDate : endDate)}
              mode="date"
              minimumDate={new Date()}
              onChange={(event, selected) => {
                if (Platform.OS === 'android') {
                  setPickerOpen(null);
                  if (event.type === 'set' && selected) {
                    if (pickerOpen === 'start') {
                      setStartDate(formatISODate(selected));
                      if (selected > parseISODate(endDate)) {
                        setEndDate(formatISODate(selected));
                      }
                    } else {
                      setEndDate(formatISODate(selected));
                    }
                  }
                } else if (selected) {
                  if (pickerOpen === 'start') {
                    setStartDate(formatISODate(selected));
                    if (selected > parseISODate(endDate)) {
                      setEndDate(formatISODate(selected));
                    }
                  } else {
                    setEndDate(formatISODate(selected));
                  }
                }
              }}
            />
            {Platform.OS === 'ios' && (
              <Pressable
                style={styles.iosPickerDone}
                onPress={() => setPickerOpen(null)}
              >
                <Text style={styles.iosPickerDoneText}>Done</Text>
              </Pressable>
            )}
          </KeyboardAvoidingView>
        )}
      </View>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function HourPicker({
  label,
  value,
  options,
  onChange,
}: {
  label:    string;
  value:    number;
  options:  number[];
  onChange: (v: number) => void;
}) {
  return (
    <View style={styles.hourPickerWrap}>
      <Text style={styles.hourPickerLabel}>{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.hourPickerRow}
      >
        {options.map((h) => {
          const selected = h === value;
          return (
            <Pressable
              key={h}
              onPress={() => onChange(h)}
              style={[styles.hourChip, selected && styles.hourChipSelected]}
            >
              <Text style={[
                styles.hourChipText,
                selected && styles.hourChipTextSelected,
              ]}>
                {h === 24 ? '12a' : h === 0 ? '12a' : h === 12 ? '12p' : h < 12 ? `${h}a` : `${h - 12}p`}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function addDays(s: string, days: number): string {
  const d = parseISODate(s);
  d.setDate(d.getDate() + days);
  return formatISODate(d);
}

function daysBetween(a: string, b: string): number {
  const da = parseISODate(a);
  const db = parseISODate(b);
  return Math.round((db.getTime() - da.getTime()) / (24 * 60 * 60 * 1000));
}

function isValidRange(a: string, b: string): boolean {
  return parseISODate(b) >= parseISODate(a);
}

function formatHuman(s: string): string {
  return parseISODate(s).toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.canvas },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Space.lg,
    paddingTop: Space.lg + 12,
    paddingBottom: Space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Brand.borderDefault,
  },
  title: {
    fontFamily: AmbitFont.display,
    fontSize: 18,
    color: Brand.inkPrimary,
  },

  setupBody: {
    paddingHorizontal: Space.lg,
    paddingTop: Space.lg,
    paddingBottom: Space.xl,
    gap: Space.md,
  },

  field: { gap: 8 },
  fieldLabel: {
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

  row: { flexDirection: 'row', gap: 12 },

  dateChip: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: Radii.md,
    backgroundColor: Brand.surface1,
    borderWidth: 1.5,
    borderColor: Brand.borderDefault,
  },
  dateChipLabel: {
    fontFamily: AmbitFont.body,
    fontSize: 10,
    color: Brand.inkLabel,
    letterSpacing: 1,
  },
  dateChipValue: {
    fontFamily: AmbitFont.body,
    fontSize: 14,
    fontWeight: '600',
    color: Brand.inkBody,
    marginTop: 2,
  },

  hourPickerWrap: { flex: 1, gap: 8 },
  hourPickerLabel: {
    fontFamily: AmbitFont.body,
    fontSize: 10,
    color: Brand.inkLabel,
    letterSpacing: 1,
  },
  hourPickerRow: { gap: 8 },
  hourChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radii.pill,
    backgroundColor: Brand.surface1,
    borderWidth: 1.5,
    borderColor: Brand.borderDefault,
  },
  hourChipSelected: {
    backgroundColor: Brand.action,
    borderColor: Brand.actionInk,
  },
  hourChipText: {
    fontFamily: AmbitFont.body,
    fontSize: 12,
    color: Brand.inkBody,
    fontWeight: '600',
  },
  hourChipTextSelected: { color: Brand.actionInk, fontWeight: '700' },

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

  primaryBtn: {
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
  primaryBtnText: {
    fontFamily: AmbitFont.body,
    fontSize: 15,
    fontWeight: '700',
    color: Brand.actionInk,
  },
  secondaryBtn: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: Radii.md,
    backgroundColor: Brand.surface1,
    borderWidth: 1.5,
    borderColor: Brand.borderDefault,
  },
  secondaryBtnText: {
    fontFamily: AmbitFont.body,
    fontSize: 15,
    color: Brand.inkPrimary,
  },

  markHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: Space.lg,
    paddingTop: Space.md,
    paddingBottom: Space.sm,
  },
  markHintText: {
    flex: 1,
    fontFamily: AmbitFont.body,
    fontSize: 13,
    color: Brand.inkMuted,
    lineHeight: 18,
  },
  markHintLink: {
    fontFamily: AmbitFont.body,
    fontSize: 13,
    fontWeight: '600',
    color: Brand.inkBody,
    paddingTop: 0,
  },
  busyLoader: {
    paddingVertical: 8,
    alignItems: 'center',
  },

  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Brand.borderDefault,
  },

  iosPickerDone: {
    alignItems: 'flex-end',
    paddingHorizontal: Space.lg,
    paddingVertical: 8,
    backgroundColor: Brand.canvas,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Brand.borderDefault,
  },
  iosPickerDoneText: {
    fontFamily: AmbitFont.body,
    fontSize: 15,
    fontWeight: '600',
    color: Brand.inkBody,
  },
});
