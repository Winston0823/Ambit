import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MagnifyingGlass, X } from 'phosphor-react-native';
import { BackChevron, Skeleton } from '../../../../components/atoms';
import { searchMessages, type SearchHit } from '../../../../lib/messaging';
import { AmbitFont, Brand, Radii, Space } from '../../../../constants/theme';

/// S-052 Message Search. Full-text search across all messages in
/// conversations the signed-in user is part of. Debounced 250ms so
/// every keystroke isn't a network hit.
export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setHits(null);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchMessages(query, 50);
        setHits(results);
      } catch {
        setHits([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  return (
    <View style={styles.root}>
      <BackChevron onPress={() => router.back()} />

      <View style={[styles.searchBar, { marginTop: insets.top + 40 }]}>
        <MagnifyingGlass size={18} color={Brand.inkMuted} weight="regular" />
        <TextInput
          autoFocus
          value={query}
          onChangeText={setQuery}
          placeholder="Search your messages…"
          placeholderTextColor={Brand.inkPlaceholder}
          style={styles.input}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')} hitSlop={10}>
            <X size={16} color={Brand.inkMuted} weight="bold" />
          </Pressable>
        )}
      </View>

      {hits === null ? (
        <View style={styles.empty}>
          <Text style={styles.emptyBody}>
            Find anything anyone's said to you, anywhere.
          </Text>
        </View>
      ) : searching ? (
        <View style={styles.results}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.hit}>
              <Skeleton width="48%" height={12} radius={6} />
              <Skeleton width="92%" height={14} radius={6} style={{ marginTop: 9 }} />
              <Skeleton width="68%" height={14} radius={6} style={{ marginTop: 6 }} />
            </View>
          ))}
        </View>
      ) : hits.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No matches</Text>
          <Text style={styles.emptyBody}>
            Try a different word, or search for a phrase.
          </Text>
        </View>
      ) : (
        <FlatList
          data={hits}
          keyExtractor={(h) => h.message_id}
          contentContainerStyle={styles.results}
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                router.replace({
                  pathname: '/chat/[id]',
                  params: { id: item.conversation_id },
                })
              }
              style={styles.hit}
            >
              <Text style={styles.hitHeader} numberOfLines={1}>
                {item.partner_name} · {item.project_title}
              </Text>
              <Text style={styles.hitBody} numberOfLines={3}>
                {item.body}
              </Text>
              <Text style={styles.hitTime}>{formatDate(item.created_at)}</Text>
            </Pressable>
          )}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </View>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.canvas },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  searchBar: {
    marginHorizontal: Space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Brand.cardCream,
    borderWidth: 1,
    borderColor: Brand.borderSoft,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: Radii.md,
  },
  input: {
    flex: 1,
    fontFamily: AmbitFont.body,
    fontSize: 15,
    color: Brand.inkBody,
    padding: 0,
  },

  empty: {
    paddingHorizontal: Space.lg,
    paddingTop: Space.xl,
    gap: 6,
  },
  emptyTitle: {
    fontFamily: AmbitFont.body,
    fontSize: 16,
    fontWeight: '600',
    color: Brand.inkHigh,
  },
  emptyBody: {
    fontFamily: AmbitFont.body,
    fontSize: 13,
    color: Brand.inkMuted,
    lineHeight: 19,
  },

  results: { paddingHorizontal: Space.lg, paddingTop: 10 },
  hit: {
    backgroundColor: Brand.cardCream,
    borderWidth: 1,
    borderColor: Brand.borderSoft,
    borderRadius: Radii.lg,
    padding: 14,
    marginBottom: 10,
    gap: 4,
  },
  hitHeader: {
    fontFamily: AmbitFont.body,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    color: Brand.actionDeep,
  },
  hitBody: {
    fontFamily: AmbitFont.body,
    fontSize: 14,
    color: Brand.inkBody,
    lineHeight: 19,
  },
  hitTime: {
    fontFamily: AmbitFont.body,
    fontSize: 11,
    color: Brand.inkMuted,
  },
});
