import React, { useState, useCallback, ReactNode } from 'react';
import { FlatList, StyleSheet, RefreshControl, View } from 'react-native';
import { FeedHeader } from '../organisms';
import { Colors, Spacing } from '../../constants/theme';

interface FeedTemplateProps {
  title: string;
  data: readonly any[];
  renderCard: (item: any, index: number) => ReactNode;
  keyExtractor: (item: any) => string;
}

export function FeedTemplate({ title, data, renderCard, keyExtractor }: FeedTemplateProps) {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  return (
    <View style={styles.container}>
      <FeedHeader title={title} />
      <FlatList
        data={data}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.brandGreen}
            colors={[Colors.brandGreen]}
          />
        }
        renderItem={({ item, index }) => (
          <View style={styles.cardWrapper}>
            {renderCard(item, index)}
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
  list: {
    paddingHorizontal: Spacing.screen,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.md,
  },
  cardWrapper: {},
});
