import React from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { Colors, Spacing, Typography } from '../../constants/theme';
import { Badge } from '../atoms';

interface InboxTemplateProps<T> {
  title: string;
  count: number;
  data: readonly T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T) => string;
}

export function InboxTemplate<T>({ title, count, data, renderItem, keyExtractor }: InboxTemplateProps<T>) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Badge label={`${count}`} variant="neighborhood" />
      </View>
      <FlatList
        data={data}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item, index }) => (
          <View style={styles.itemWrapper}>
            {renderItem(item, index)}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.warmWhite,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm + 4,
    paddingHorizontal: Spacing.screen,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  title: {
    ...Typography.heading,
  },
  list: {
    paddingHorizontal: Spacing.screen,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.md,
  },
  itemWrapper: {},
});
