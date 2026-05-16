import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { StatusDot } from '../atoms';
import { Colors, Spacing, Typography } from '../../constants/theme';

interface ResponseRateBadgeProps {
  rate: number;
}

function getStatus(rate: number): 'online' | 'active' | 'idle' {
  if (rate >= 0.9) return 'online';
  if (rate >= 0.75) return 'active';
  return 'idle';
}

export function ResponseRateBadge({ rate }: ResponseRateBadgeProps) {
  return (
    <View style={styles.container}>
      <StatusDot status={getStatus(rate)} />
      <Text style={styles.text}>{Math.round(rate * 100)}% response rate</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
  },
  text: {
    ...Typography.caption,
  },
});
