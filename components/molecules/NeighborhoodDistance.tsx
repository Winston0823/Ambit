import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Badge } from '../atoms';
import { Colors, Spacing, Typography } from '../../constants/theme';

interface NeighborhoodDistanceProps {
  neighborhood: string;
  distance: string;
}

export function NeighborhoodDistance({ neighborhood, distance }: NeighborhoodDistanceProps) {
  return (
    <View style={styles.container}>
      <Badge label={neighborhood} variant="neighborhood" />
      <Text style={styles.distance}>{distance} away</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  distance: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
});
