import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors } from '../../constants/theme';

type Status = 'online' | 'active' | 'idle';

interface StatusDotProps {
  status: Status;
}

const statusColors: Record<Status, string> = {
  online: Colors.successGreen,
  active: Colors.brandGreen,
  idle: Colors.textTertiary,
};

export function StatusDot({ status }: StatusDotProps) {
  return <View style={[styles.dot, { backgroundColor: statusColors[status] }]} />;
}

const styles = StyleSheet.create({
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
