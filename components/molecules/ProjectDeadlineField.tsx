import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { CalendarBlank, X } from 'phosphor-react-native';
import { AmbitFont, Brand, Radii } from '../../constants/theme';

interface Props {
  /// Selected deadline, or null when none set.
  value: Date | null;
  onChange: (next: Date | null) => void;
  label?: string;
}

/// Optional "needs someone by ___" deadline picker for the project create /
/// edit flows. Tappable row that opens the native date picker (no past dates);
/// shows a Clear affordance once a date is chosen.
export function ProjectDeadlineField({ value, onChange, label = 'NEEDS SOMEONE BY' }: Props) {
  const [showPicker, setShowPicker] = useState(false);

  const open = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    setShowPicker(true);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <Pressable onPress={open} style={styles.field} accessibilityLabel="Set a deadline">
          <CalendarBlank size={18} color={value ? Brand.actionDeep : Brand.inkMuted} weight="bold" />
          <Text style={[styles.value, !value && styles.placeholder]}>
            {value ? formatLong(value) : 'Add a deadline · optional'}
          </Text>
        </Pressable>
        {value && (
          <Pressable onPress={() => onChange(null)} hitSlop={10} style={styles.clear} accessibilityLabel="Clear deadline">
            <X size={16} color={Brand.inkMuted} weight="bold" />
          </Pressable>
        )}
      </View>

      {showPicker && (
        <DateTimePicker
          value={value ?? defaultDate()}
          mode="date"
          minimumDate={new Date()}
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={(event, date) => {
            // Android fires once and dismisses itself; iOS stays inline.
            if (Platform.OS !== 'ios') setShowPicker(false);
            if (event.type === 'dismissed') return;
            if (date) onChange(date);
          }}
        />
      )}
    </View>
  );
}

/// Default the picker to ~2 weeks out so the first tap lands on a sensible date.
function defaultDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d;
}

function formatLong(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

const styles = StyleSheet.create({
  wrap: { marginTop: 36 },
  label: {
    fontFamily: AmbitFont.body,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
    color: Brand.inkLabel,
    marginBottom: 12,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  field: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: Radii.lg,
    backgroundColor: Brand.surface1,
    borderWidth: 1.5,
    borderColor: Brand.inkEdge,
  },
  value: { fontFamily: AmbitFont.body, fontSize: 15, fontWeight: '600', color: Brand.inkPrimary },
  placeholder: { fontWeight: '500', color: Brand.inkMuted },
  clear: { padding: 8 },
});
