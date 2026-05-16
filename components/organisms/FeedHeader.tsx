import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Icon } from '../atoms';
import { Colors, Spacing, Typography } from '../../constants/theme';

interface FeedHeaderProps {
  title: string;
  neighborhoods?: string[];
}

const allNeighborhoods = ['All', 'SOMA', 'Mission', 'Hayes Valley', 'FiDi', 'Dogpatch', 'Noe Valley', 'Oakland', 'Palo Alto'];

export function FeedHeader({ title, neighborhoods = allNeighborhoods }: FeedHeaderProps) {
  const [selected, setSelected] = useState('All');
  const [showFilter, setShowFilter] = useState(false);

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{title}</Text>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowFilter(!showFilter)}
          activeOpacity={0.7}
        >
          <Icon name="map-pin" size={18} color={Colors.brandGreen} />
          <Text style={styles.filterText}>{selected}</Text>
          <Icon name="chevron-down" size={16} color={Colors.brandGreen} />
        </TouchableOpacity>
      </View>
      {showFilter && (
        <View style={styles.filterRow}>
          {neighborhoods.map((n) => (
            <TouchableOpacity
              key={n}
              style={[styles.chip, selected === n && styles.chipSelected]}
              onPress={() => { setSelected(n); setShowFilter(false); }}
            >
              <Text style={[styles.chipText, selected === n && styles.chipTextSelected]}>{n}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.screen,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.warmWhite,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    ...Typography.heading,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.badgeGreen,
    paddingHorizontal: Spacing.sm + 4,
    paddingVertical: Spacing.xs + 2,
    borderRadius: 20,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.brandGreen,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.sm + 4,
  },
  chip: {
    paddingHorizontal: Spacing.sm + 4,
    paddingVertical: Spacing.xs + 2,
    borderRadius: 16,
    backgroundColor: Colors.warmGray,
  },
  chipSelected: {
    backgroundColor: Colors.brandGreen,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  chipTextSelected: {
    color: Colors.white,
  },
});
