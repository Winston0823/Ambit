import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AmbitFont, Brand, Space } from '../../constants/theme';

/// Centered day divider in a chat thread ("Today" / "Yesterday" / a weekday /
/// a date). Quiet and muted — it sections the conversation without competing
/// with the bubbles.
export function DaySeparator({ label }: { label: string }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

/// "Today" / "Yesterday" / weekday (<7d) / "June 2" for a message timestamp.
export function dayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return d.toLocaleDateString(undefined, { weekday: 'long' });
  return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
}

/// True when two ISO timestamps fall on the same calendar day.
export function sameDay(a: string, b: string): boolean {
  const x = new Date(a);
  const y = new Date(b);
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', marginTop: Space.lg, marginBottom: Space.sm },
  label: {
    fontFamily: AmbitFont.body,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    color: Brand.inkMuted,
  },
});
