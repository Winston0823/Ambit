import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Icon } from '../atoms';
import { Colors, Spacing, Typography } from '../../constants/theme';

interface TimerBadgeProps {
  hoursRemaining: number;
}

export function TimerBadge({ hoursRemaining }: TimerBadgeProps) {
  const isUrgent = hoursRemaining < 12;
  const color = isUrgent ? Colors.coral : Colors.textSecondary;
  const bgColor = isUrgent ? Colors.badgeCoral : Colors.warmGray;

  const display =
    hoursRemaining < 1
      ? '< 1hr left'
      : hoursRemaining < 24
      ? `${Math.round(hoursRemaining)}hr left`
      : `${Math.round(hoursRemaining / 24)}d ${Math.round(hoursRemaining % 24)}hr left`;

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <Icon name="clock" size={14} color={color} />
      <Text style={[styles.text, { color }]}>{display}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
});
