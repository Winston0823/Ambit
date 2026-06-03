import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MagnifyingGlass, Plus } from 'phosphor-react-native';
import * as Haptics from 'expo-haptics';
import {
  InboxRow,
  PassReasonSheet,
  PinnedStrip,
} from '../../../components/molecules';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../lib/supabase';
import {
  getInbox,
  isReachedOutToYou,
  pinConversation,
  unpinConversation,
  type InboxItem,
} from '../../../lib/messaging';
import { Brand, Space } from '../../../constants/theme';

/// S-050 Inbox v4. Editorial paper canvas. "ambit" wordmark + side
/// icons up top, large italic "Chats" title, iMessage-style pinned
/// strip, then a flat list — no day groupings.
export default function ChatTab() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<InboxItem[] | null>(null);
  const [passTargetId, setPassTargetId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

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

  // Pull-to-refresh. The inbox already updates live via the realtime
  // subscription below, but a manual drag-down gives users an explicit
  // way to re-fetch (and a clear spinner) when they want it.
  const handleRefresh = useCallback(async () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

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

  // Split pinned vs the rest. get_inbox already sorts pinned to the
  // top after hired_pending; we slice rather than re-sort so the
  // server's ordering wins.
  const { pinned, rest } = useMemo(() => {
    const all = items ?? [];
    return {
      pinned: all.filter((i) => i.is_pinned),
      rest:   all.filter((i) => !i.is_pinned),
    };
  }, [items]);

  // Pin / unpin via long-press. Surfaces the `pin_limit_reached` error
  // verbatim as a friendly alert; optimistic-updates the row so the
  // pinned strip reflects the change before the next refetch.
  const handleTogglePin = useCallback(async (item: InboxItem) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    const next = !item.is_pinned;
    setItems((prev) =>
      (prev ?? []).map((it) =>
        it.conversation_id === item.conversation_id
          ? { ...it, is_pinned: next, pinned_at: next ? new Date().toISOString() : null }
          : it,
      ),
    );
    try {
      if (next) await pinConversation(item.conversation_id);
      else      await unpinConversation(item.conversation_id);
    } catch (e: any) {
      // Roll back the optimistic update and surface a message.
      setItems((prev) =>
        (prev ?? []).map((it) =>
          it.conversation_id === item.conversation_id
            ? { ...it, is_pinned: !next, pinned_at: !next ? new Date().toISOString() : null }
            : it,
        ),
      );
      const msg = String(e?.message ?? '');
      if (msg.includes('pin_limit_reached')) {
        Alert.alert('Pinned chats full', 'Unpin one first — iMessage caps at four.');
      } else {
        Alert.alert("Couldn't update pin", msg || 'Try again.');
      }
    }
  }, []);

  const openConversation = useCallback((id: string) => {
    router.push({ pathname: '/chat/[id]', params: { id } });
  }, []);

  // Apply the top inset as padding so the cream bg extends edge-to-edge
  // (no clipping above) while content still sits below the Dynamic Island.
  const safeTopPad = { paddingTop: insets.top };

  if (items === null) {
    // Skeleton rows rather than a centered spinner — matches the feed's
    // skeleton loading treatment so the loading vocabulary is consistent
    // across tabs.
    return (
      <View style={[styles.root, safeTopPad]}>
        <InboxSkeleton />
      </View>
    );
  }

  return (
    <View style={[styles.root, safeTopPad]}>
      <FlatList
        data={rest}
        keyExtractor={(i) => i.conversation_id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Brand.accent}
            colors={[Brand.accent]}
          />
        }
        renderItem={({ item }) =>
          user ? (
            <InboxRow
              item={item}
              meId={user.id}
              onPress={() => openConversation(item.conversation_id)}
              onPassRequest={(id) => setPassTargetId(id)}
              onLongPress={handleTogglePin}
            />
          ) : null
        }
        ItemSeparatorComponent={({ leadingItem }: { leadingItem: InboxItem }) => {
          // No hairline below a pending card — they're full boxes that
          // already terminate the row. Only flat active rows get the
          // hairline divider, indented past the avatar.
          const leadingPending =
            user ? isReachedOutToYou(leadingItem, user.id) : false;
          return leadingPending
            ? <View style={styles.sepGap} />
            : <View style={styles.sep} />;
        }}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <ListHeader
            user={user}
            pinned={pinned}
            onOpen={openConversation}
            onUnpin={handleTogglePin}
          />
        }
        ListEmptyComponent={
          pinned.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Nothing here yet</Text>
              <Text style={styles.emptyBody}>
                Swipe up on a project in Discovery and send a hello. Replies land here.
              </Text>
            </View>
          ) : null
        }
      />

      <PassReasonSheet
        visible={!!passTargetId}
        conversationId={passTargetId}
        onClose={() => setPassTargetId(null)}
        onPassed={(id, reason) => {
          setItems((prev) =>
            (prev ?? []).map((it) =>
              it.conversation_id === id
                ? { ...it, status: 'passed', pass_reason: reason }
                : it,
            ),
          );
        }}
      />
    </View>
  );
}

/// Scrolls with the list — keeps the wordmark / title / pinned strip
/// out of any scroll-pin behavior so the v4 reading rhythm is preserved.
function ListHeader({
  user,
  pinned,
  onOpen,
  onUnpin,
}: {
  user:   { id: string } | null;
  pinned: InboxItem[];
  onOpen: (conversationId: string) => void;
  onUnpin: (item: InboxItem) => void;
}) {
  return (
    <View>
      {/* Top bar — matches the Discovery layout: icon left, centered title,
          icon right. "Messages" replaces the old "ambit" wordmark; the
          separate title row below it is gone. */}
      <View style={styles.topbar}>
        <Pressable
          onPress={() => router.push('/chat/new')}
          hitSlop={12}
          style={styles.leftBtn}
          accessibilityRole="button"
          accessibilityLabel="New chat"
        >
          <Plus size={22} color={Brand.inboxInkPrimary} weight="bold" />
        </Pressable>
        <Text style={styles.title}>Messages</Text>
        <Pressable
          onPress={() => router.push('/chat/search')}
          hitSlop={12}
          style={styles.rightBtn}
          accessibilityRole="button"
          accessibilityLabel="Search messages"
        >
          <MagnifyingGlass size={22} color={Brand.inboxInkPrimary} weight="regular" />
        </Pressable>
      </View>

      {/* Pinned strip (only when there's at least one) */}
      {user && (
        <PinnedStrip
          items={pinned}
          meId={user.id}
          onPress={onOpen}
          onLongPress={onUnpin}
        />
      )}
    </View>
  );
}

/// Loading placeholder — wordmark/title chrome plus a handful of greyed
/// row stand-ins. Mirrors the feed's skeleton-card approach so both tabs
/// speak the same loading language.
function InboxSkeleton() {
  return (
    <View style={styles.skeletonWrap}>
      <View style={styles.skeletonTitle} />
      {Array.from({ length: 6 }).map((_, i) => (
        <View key={i} style={styles.skeletonRow}>
          <View style={styles.skeletonAvatar} />
          <View style={styles.skeletonLines}>
            <View style={styles.skeletonLineWide} />
            <View style={styles.skeletonLineNarrow} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.inboxCanvas },
  center: { alignItems: 'center', justifyContent: 'center' },

  // ── Loading skeleton ──────────────────────────────────────────
  skeletonWrap: { paddingHorizontal: 22, paddingTop: 28 },
  skeletonTitle: {
    width: 140,
    height: 28,
    borderRadius: 8,
    backgroundColor: Brand.inboxCardActive,
    marginBottom: 24,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
  },
  skeletonAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Brand.inboxCardActive,
  },
  skeletonLines: { flex: 1, gap: 8 },
  skeletonLineWide: {
    width: '60%',
    height: 13,
    borderRadius: 6,
    backgroundColor: Brand.inboxCardActive,
  },
  skeletonLineNarrow: {
    width: '40%',
    height: 11,
    borderRadius: 6,
    backgroundColor: Brand.inboxCardActive,
  },

  // ── Top bar — mirrors the Discovery feed bar (44pt, centered title,
  //    absolutely-positioned icons at Space.lg from each edge).
  topbar: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    // The header renders inside the FlatList content container, which has
    // paddingHorizontal: 18 (see listContent). Cancel it here so the bar is
    // full-bleed and the icons sit at Space.lg from the SCREEN edge —
    // matching the Discovery feed's icon X positions exactly.
    marginHorizontal: -18,
  },
  leftBtn: {
    position: 'absolute',
    left: Space.lg,
    top: 0,
    bottom: 0,
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightBtn: {
    position: 'absolute',
    right: Space.lg,
    top: 0,
    bottom: 0,
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'Zodiak-Bold',
    fontStyle: 'italic',
    fontSize: 24,
    color: Brand.inboxInkPrimary,
    letterSpacing: -0.5,
  },

  // ── List — flat rows with hairline separators ────────────────
  listContent: {
    paddingHorizontal: 18,
    paddingBottom: 100,
  },
  sep: {
    height: 1,
    backgroundColor: Brand.inboxHairline,
    marginLeft: 18 + 48 + 14, // align past avatar (card pad + avatar + gap)
  },
  sepGap: { height: 12 }, // breathing room below a pending card

  // ── Empty ─────────────────────────────────────────────────────
  empty: {
    marginHorizontal: 4,
    marginTop: 8,
    padding: 18,
    backgroundColor: Brand.inboxCardActive,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Brand.inboxHairline,
  },
  emptyTitle: {
    fontFamily: 'Zodiak-Bold',
    fontSize: 18,
    color: Brand.inboxInkPrimary,
    letterSpacing: -0.3,
  },
  emptyBody: {
    fontSize: 13.5,
    color: Brand.inboxInkBody,
    marginTop: 6,
    lineHeight: 19,
  },
});
