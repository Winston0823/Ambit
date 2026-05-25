import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { MagnifyingGlass } from 'phosphor-react-native';
import { InboxRow } from '../../../components/molecules';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../lib/supabase';
import { getInbox, type InboxItem } from '../../../lib/messaging';
import { AmbitFont, Brand, Radii, Space } from '../../../constants/theme';

/// S-050 Inbox. Lists every conversation the signed-in user is in,
/// sorted by last_message_at. Refetches on focus AND subscribes to
/// inserts/updates on `messages` so the list reorders live without
/// needing to leave and re-enter the tab.
export default function ChatTab() {
  const { user } = useAuth();
  const [items, setItems] = useState<InboxItem[] | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setItems([]);
      return;
    }
    try {
      const data = await getInbox();
      setItems(data);
    } catch (e) {
      console.warn('inbox load failed:', e);
      setItems([]);
    }
  }, [user?.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Realtime: any new/edited message in any of my conversations should
  // refresh the inbox. We can't filter to "conversations I'm in" via
  // postgres filter syntax, so we listen broadly and let getInbox()
  // re-resolve.
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel('inbox-watch')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        () => { load(); },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversation_reads', filter: `user_id=eq.${user.id}` },
        () => { load(); },
      )
      .subscribe();
    return () => { ch.unsubscribe(); };
  }, [user?.id, load]);

  if (items === null) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={Brand.accent} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>CONVERSATIONS</Text>
        <Text style={styles.title}>Inbox</Text>
        <Pressable
          onPress={() => router.push('/chat/search')}
          style={styles.searchBtn}
          accessibilityLabel="Search messages"
        >
          <MagnifyingGlass size={18} color={Brand.inkMuted} weight="regular" />
          <Text style={styles.searchHint}>Search messages…</Text>
        </Pressable>
      </View>

      {items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Nothing here yet</Text>
          <Text style={styles.emptyBody}>
            Swipe up on a project in Discovery and send a hello. Replies land here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.conversation_id}
          renderItem={({ item }) =>
            user ? (
              <InboxRow
                item={item}
                meId={user.id}
                onPress={() =>
                  router.push({
                    pathname: '/chat/[id]',
                    params: { id: item.conversation_id },
                  })
                }
              />
            ) : null
          }
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.canvas },
  center: { alignItems: 'center', justifyContent: 'center' },

  header: {
    paddingHorizontal: Space.lg,
    paddingTop: Space.lg,
    paddingBottom: Space.md,
    gap: 10,
  },
  eyebrow: {
    fontFamily: AmbitFont.body,
    fontSize: 11,
    letterSpacing: 1.2,
    color: Brand.inkLabel,
  },
  title: {
    fontFamily: AmbitFont.display,
    fontSize: 30,
    color: Brand.inkPrimary,
    marginTop: -6,
  },
  searchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Brand.surface1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: Radii.md,
    marginTop: 4,
  },
  searchHint: {
    fontFamily: AmbitFont.body,
    fontSize: 14,
    color: Brand.inkPlaceholder,
  },

  empty: {
    margin: Space.lg,
    padding: Space.lg,
    backgroundColor: Brand.surface1,
    borderRadius: Radii.lg,
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
    marginTop: 6,
    lineHeight: 19,
  },

  sep: {
    height: 1,
    backgroundColor: Brand.borderDefault,
    marginLeft: 76,
  },
});
