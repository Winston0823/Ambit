import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Avatar, HardShadow, Skeleton } from '../../../../components/atoms';
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
import { router, useFocusEffect, useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Archive, ArrowCounterClockwise, CaretRight, MagnifyingGlass, Plus } from 'phosphor-react-native';
import * as Haptics from 'expo-haptics';
import {
  InboxRow,
  PassReasonSheet,
  PinnedStrip,
} from '../../../../components/molecules';
import { useAuth } from '../../../../context/AuthContext';
import { supabase } from '../../../../lib/supabase';
import { fetchPeerPhotos } from '../../../../lib/photoReveal';
import {
  getInbox,
  inboxState,
  isReachedOutToYou,
  pinConversation,
  setConversationArchived,
  setConversationMuted,
  unpinConversation,
  type InboxFilter,
  type InboxItem,
} from '../../../../lib/messaging';
import { AmbitFont, Brand, Radii, Space } from '../../../../constants/theme';
import { toast } from '../../../../lib/toast';

/// S-050 Inbox v4. Editorial paper canvas. Single header row —
/// "Messages" title on the left, + / search icons on the right —
/// iMessage-style pinned strip, then a flat list — no day groupings.
export default function ChatTab() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const segments = useSegments();
  const [items, setItems] = useState<InboxItem[] | null>(null);
  /// Revealed real photos keyed by partner id — mutual conversations only
  /// (fetch_peer_photos gate). Rows with no entry render the monster mark.
  const [revealed, setRevealed] = useState<Map<string, string>>(new Map());
  const [passTargetId, setPassTargetId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<InboxFilter>('all');
  const [archivedExpanded, setArchivedExpanded] = useState(false);

  // The "+" button opens the discovery feed to find new people to reach out
  // to. Route to the correct group so the user stays in their context.
  const discoveryPath = segments[0] === '(founder)' ? '/(founder)/feed' : '/(candidate)/feed';

  const load = useCallback(async () => {
    if (!user) {
      setItems([]);
      return;
    }
    try {
      const data = await getInbox();
      setItems(data);
      // One batched reveal fetch for every partner in the inbox. The RPC
      // returns a photo only for mutual threads; everyone else stays a
      // monster mark. Never throws.
      const peerIds = data.map((d) => d.partner_id);
      setRevealed(await fetchPeerPhotos(peerIds));
    } catch (e) {
      console.warn('inbox load failed:', e);
      // Don't clobber to [] — a failed load must not read as "no conversations
      // yet." Keep whatever we already had (or leave the skeleton on a cold
      // load) and surface a retryable error.
      setItems((prev) => prev ?? []);
      toast.error("Couldn't load your messages.", {
        actionLabel: 'Retry',
        onAction: () => { void load(); },
      });
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

    // Adopt an existing live channel if already registered (fast-refresh /
    // remount) — .on() after subscribe() throws, so only wire + subscribe +
    // tear down a channel we create.
    const topic = 'inbox-watch';
    const existing = supabase.getChannels().find((c) => c.topic === `realtime:${topic}`);
    if (existing) return;

    // Debounce refetches: a burst of message inserts (e.g. someone sends a
    // few lines quickly, or several threads update at once) would otherwise
    // fire a full get_inbox per row. Trailing 300ms coalesces the burst into
    // one refetch.
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleLoad = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => { load(); }, 300);
    };

    const ch = supabase
      .channel(topic)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        scheduleLoad,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversation_reads', filter: `user_id=eq.${user.id}` },
        scheduleLoad,
      )
      .subscribe();
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(ch);
    };
  }, [user?.id, load]);

  // Split pinned vs the rest. get_inbox already sorts pinned to the
  // top after hired_pending; we slice rather than re-sort so the
  // server's ordering wins.
  const { pinned, rest } = useMemo(() => {
    const all = items ?? [];
    return {
      pinned: all.filter((i) => i.is_pinned && !i.is_archived),
      rest:   all.filter((i) => !i.is_pinned),
    };
  }, [items]);

  // Archived conversations — surfaced in a collapsible section at the bottom
  // of the list so archiving is recoverable beyond the undo toast's lifetime.
  const archived = useMemo(
    () => (items ?? []).filter((i) => i.is_archived),
    [items],
  );

  // Archived rows are hidden from every tab; the rest get the active filter.
  const filteredRest = useMemo(() => {
    const visible = rest.filter((i) => !i.is_archived);
    if (!user || filter === 'all') return visible;
    return visible.filter((i) =>
      filter === 'unread' ? i.unread_count > 0 : inboxState(i, user.id) === filter,
    );
  }, [rest, filter, user]);

  const patchItem = useCallback((id: string, patch: Partial<InboxItem>) => {
    setItems((prev) => (prev ?? []).map((it) => (it.conversation_id === id ? { ...it, ...patch } : it)));
  }, []);

  const handleMute = useCallback(async (item: InboxItem) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    const next = !item.is_muted;
    patchItem(item.conversation_id, { is_muted: next });
    try { await setConversationMuted(item.conversation_id, next); }
    catch { patchItem(item.conversation_id, { is_muted: !next }); }
  }, [patchItem]);

  const handleUnarchive = useCallback(async (item: InboxItem) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    patchItem(item.conversation_id, { is_archived: false });
    try { await setConversationArchived(item.conversation_id, false); }
    catch { patchItem(item.conversation_id, { is_archived: true }); }
  }, [patchItem]);

  const handleArchive = useCallback(async (item: InboxItem) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    patchItem(item.conversation_id, { is_archived: true });
    try {
      await setConversationArchived(item.conversation_id, true);
    } catch {
      patchItem(item.conversation_id, { is_archived: false });
      toast.error("Couldn't archive that chat.");
      return;
    }
    // Shared toast bus (replaces the hand-rolled undo pill). Even after the
    // toast auto-dismisses, the conversation is recoverable from the
    // "Archived" section at the bottom of the list.
    toast.success('Archived', {
      actionLabel: 'Undo',
      onAction: () => { void handleUnarchive(item); },
    });
  }, [patchItem, handleUnarchive]);

  // Pin / unpin — triggered by the inbox row's swipe-left Pin action (and by
  // long-pressing a pinned avatar in the strip). Surfaces the `pin_limit_reached`
  // error verbatim as a friendly alert; optimistic-updates the row so the
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
        Alert.alert('Pinned chats full', 'You can pin up to 4 chats. Unpin one first.');
      } else {
        Alert.alert("Couldn't update pin", msg || 'Try again.');
      }
    }
  }, []);

  const openConversation = useCallback((id: string) => {
    // Clear the unread highlight immediately (the thread marks it read on open;
    // the focus refetch confirms). Feels instant instead of waiting on refetch.
    patchItem(id, { unread_count: 0 });
    router.push({ pathname: '/chat/[id]', params: { id } });
  }, [patchItem]);

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
        data={filteredRest}
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
              photoUrl={revealed.get(item.partner_id) ?? null}
              onPress={() => openConversation(item.conversation_id)}
              onPassRequest={(id) => setPassTargetId(id)}
              onPin={handleTogglePin}
              onMute={handleMute}
              onArchive={handleArchive}
            />
          ) : null
        }
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <ListHeader
            user={user}
            pinned={pinned}
            revealed={revealed}
            onOpen={openConversation}
            onUnpin={handleTogglePin}
            discoveryPath={discoveryPath}
            filter={filter}
            onFilter={setFilter}
          />
        }
        ListFooterComponent={
          archived.length > 0 ? (
            <View style={styles.archivedSection}>
              <Pressable
                onPress={() => {
                  if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
                  setArchivedExpanded((x) => !x);
                }}
                style={styles.archivedHeader}
                accessibilityRole="button"
                accessibilityLabel={`Archived, ${archived.length} conversations`}
              >
                <Archive size={16} color={Brand.inkLabel} weight="bold" />
                <Text style={styles.archivedHeaderText}>Archived ({archived.length})</Text>
                <CaretRight
                  size={15}
                  color={Brand.inkMuted}
                  weight="bold"
                  style={{ transform: [{ rotate: archivedExpanded ? '90deg' : '0deg' }] }}
                />
              </Pressable>
              {archivedExpanded &&
                archived.map((item) => (
                  <ArchivedRow
                    key={item.conversation_id}
                    item={item}
                    photoUrl={revealed.get(item.partner_id) ?? null}
                    onOpen={() => openConversation(item.conversation_id)}
                    onUnarchive={() => handleUnarchive(item)}
                  />
                ))}
            </View>
          ) : null
        }
        ListEmptyComponent={
          pinned.length === 0 ? (
            // A non-empty inbox with an active filter (or pinned-only rows)
            // that yields no list rows is a filter MISS, not a truly empty
            // inbox — say so rather than the onboarding "nothing yet" copy.
            (items?.length ?? 0) > 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>No matches</Text>
                <Text style={styles.emptyBody}>
                  {filter === 'all'
                    ? 'Nothing to show here right now.'
                    : `No conversations under “${INBOX_TABS.find((t) => t.key === filter)?.label ?? filter}.” Try another filter.`}
                </Text>
              </View>
            ) : (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>Nothing here yet</Text>
                <Text style={styles.emptyBody}>
                  {segments[0] === '(founder)'
                    ? 'Reach out to a candidate in Discovery and start a conversation. Replies land here.'
                    : 'Swipe up on a project in Discovery and send a hello. Replies land here.'}
                </Text>
              </View>
            )
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

/// Compact row for an archived conversation. Tapping the body opens the
/// thread; the trailing "Unarchive" button restores it to the active list.
function ArchivedRow({
  item,
  photoUrl,
  onOpen,
  onUnarchive,
}: {
  item: InboxItem;
  photoUrl: string | null;
  onOpen: () => void;
  onUnarchive: () => void;
}) {
  const preview = item.last_message_deleted
    ? 'Message deleted'
    : item.last_message_body
      ? item.last_message_body
      : item.last_message_attachment_url
        ? 'Photo'
        : 'Say hi';
  return (
    <View style={styles.archivedRow}>
      <Pressable style={styles.archivedRowMain} onPress={onOpen}>
        <Avatar avatarId={item.partner_avatar_id} photoUrl={photoUrl} size={40} />
        <View style={styles.archivedMeta}>
          <Text style={styles.archivedName} numberOfLines={1}>
            {item.partner_name ?? 'Someone'}
          </Text>
          <Text style={styles.archivedPreview} numberOfLines={1}>
            {preview}
          </Text>
        </View>
      </Pressable>
      <Pressable
        onPress={onUnarchive}
        hitSlop={8}
        style={styles.unarchiveBtn}
        accessibilityRole="button"
        accessibilityLabel={`Unarchive conversation with ${item.partner_name ?? 'this person'}`}
      >
        <ArrowCounterClockwise size={14} color={Brand.inkOnBrand} weight="bold" />
        <Text style={styles.unarchiveBtnText}>Unarchive</Text>
      </Pressable>
    </View>
  );
}

/// Scrolls with the list — keeps the wordmark / title / pinned strip
/// out of any scroll-pin behavior so the v4 reading rhythm is preserved.
const INBOX_TABS: { key: InboxFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'your_turn', label: 'Your turn' },
  { key: 'hired', label: 'Hired' },
];

function ListHeader({
  user,
  pinned,
  revealed,
  onOpen,
  onUnpin,
  discoveryPath,
  filter,
  onFilter,
}: {
  user:   { id: string } | null;
  pinned: InboxItem[];
  revealed: Map<string, string>;
  onOpen: (conversationId: string) => void;
  onUnpin: (item: InboxItem) => void;
  discoveryPath: string;
  filter: InboxFilter;
  onFilter: (f: InboxFilter) => void;
}) {
  return (
    <View>
      {/* Single header row — "Messages" title on the left, the + and
          search actions grouped on the right. Replaces the old two-layer
          chrome (ambit wordmark bar + separate title/icon row). */}
      <View style={styles.topbar}>
        <Text style={styles.title}>Messages</Text>
        <View style={styles.topbarActions}>
          <Pressable
            onPress={() => router.push('/chat/new')}
            hitSlop={12}
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel="New chat"
          >
            <Plus size={22} color={Brand.inkPrimary} weight="bold" />
          </Pressable>
          <Pressable
            onPress={() => router.push('/chat/search')}
            hitSlop={12}
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel="Search messages"
          >
            <MagnifyingGlass size={22} color={Brand.inkPrimary} weight="regular" />
          </Pressable>
        </View>
      </View>

      {/* Segmented filter — role-agnostic (works for whoever reached out). */}
      <View style={styles.filterRow}>
        {INBOX_TABS.map((t) => {
          const active = filter === t.key;
          const pill = (
            <Pressable
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
                onFilter(t.key);
              }}
              style={[styles.filterChip, active && styles.filterChipActive]}
              accessibilityRole="button"
              accessibilityLabel={`Filter: ${t.label}`}
            >
              <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{t.label}</Text>
            </Pressable>
          );
          // Active tab gets the crisp hard shadow via a solid backing block.
          return active
            ? <HardShadow key={t.key} radius={999} offset={4}>{pill}</HardShadow>
            : <React.Fragment key={t.key}>{pill}</React.Fragment>;
        })}
      </View>

      {/* Pinned strip — only on All (a filtered view shows just its matches). */}
      {user && filter === 'all' && (
        <PinnedStrip
          items={pinned}
          meId={user.id}
          revealed={revealed}
          onPress={onOpen}
          onLongPress={onUnpin}
        />
      )}
    </View>
  );
}

/// Loading placeholder — header chrome plus a handful of greyed
/// row stand-ins. Mirrors the feed's skeleton-card approach so both tabs
/// speak the same loading language.
function InboxSkeleton() {
  return (
    <View style={{ flex: 1 }}>
      {/* Header: 44pt bar — "Messages" title left, + / search icons right. */}
      <View style={styles.skelTopbar}>
        <Skeleton width={120} height={24} radius={8} />
        <View style={styles.skelTopbarActions}>
          <Skeleton width={36} height={36} radius={18} />
          <Skeleton width={36} height={36} radius={18} />
        </View>
      </View>
      {/* Filter chips row (All / Unread / Your turn / Hired). */}
      <View style={styles.skelFilters}>
        {[56, 74, 84, 64].map((w, i) => (
          <Skeleton key={i} width={w} height={34} radius={999} />
        ))}
      </View>
      {/* Inbox-row cards — cream island, ink border, hard offset edge, a
          48 rounded-square avatar, name + tiny byline + time, and an indented
          preview line (under the name, like the real row). */}
      <View style={styles.skelList}>
        {Array.from({ length: 5 }).map((_, i) => (
          <HardShadow key={i} radius={Radii.card} offset={4} style={styles.skelRowShadow}>
            <View style={styles.skelCard}>
              <View style={styles.skelTopRow}>
                <View style={styles.skelTopLeft}>
                  <Skeleton width={48} height={48} radius={12} />
                  <View style={styles.skelNameBlock}>
                    <Skeleton width={130} height={18} radius={6} />
                    <Skeleton width={92} height={9} radius={4} style={{ marginTop: 7 }} />
                  </View>
                </View>
                <Skeleton width={28} height={11} radius={5} />
              </View>
              <View style={styles.skelSubBlock}>
                <Skeleton width="74%" height={13} radius={6} />
              </View>
            </View>
          </HardShadow>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.canvas },
  center: { alignItems: 'center', justifyContent: 'center' },

  // ── Loading skeleton — mirrors the real header + InboxRow island cards ──
  skelTopbar: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Space.lg,
    marginBottom: 8,
  },
  skelTopbarActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  skelFilters: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 2,
    paddingBottom: 12,
  },
  skelList: { paddingHorizontal: 20 },
  skelRowShadow: { marginBottom: 12 },
  skelCard: {
    backgroundColor: Brand.cardCream,
    borderRadius: Radii.card,
    padding: 16,
    gap: 8,
  },
  skelTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  skelTopLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  skelNameBlock: { flex: 1 },
  skelSubBlock: { paddingLeft: 62 }, // SUB_INDENT — preview aligns under the name

  // ── Top bar — mirrors the Discovery feed bar (44pt, centered title,
  //    absolutely-positioned icons at Space.lg from each edge).
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 12,
    paddingTop: 2,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'transparent',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Brand.borderSoft,
  },
  // Selected chip = ASTRA selected purple (#9362C8) with white ink.
  filterChipActive: { backgroundColor: Brand.selected, borderWidth: 1.5, borderColor: Brand.selected },
  filterChipText: { fontFamily: AmbitFont.semibold, fontSize: 13.5, color: Brand.inkBody },
  filterChipTextActive: { fontFamily: AmbitFont.bold, color: Brand.inkOnBrand },

  // ── Archived section (collapsible, bottom of list) ────────────
  archivedSection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Brand.borderSoft,
  },
  archivedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  archivedHeaderText: {
    flex: 1,
    fontFamily: AmbitFont.body,
    fontSize: 13.5,
    fontWeight: '700',
    letterSpacing: 0.2,
    color: Brand.inkLabel,
  },
  archivedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  archivedRowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
  },
  archivedAvatar: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Brand.surface2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  archivedAvatarImg: { width: 40, height: 40, borderRadius: 10 },
  archivedAvatarInitial: {
    fontFamily: AmbitFont.display,
    fontSize: 16,
    color: Brand.inkLabel,
  },
  archivedMeta: { flex: 1, minWidth: 0 },
  archivedName: {
    fontFamily: AmbitFont.body,
    fontSize: 15,
    fontWeight: '600',
    color: Brand.inkBody,
  },
  archivedPreview: {
    fontFamily: AmbitFont.body,
    fontSize: 13,
    color: Brand.inkMuted,
    marginTop: 1,
  },
  unarchiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: Brand.action,
    // ASTRA: borderless purple CTA lifted by a soft shadow.
    shadowColor: Brand.action,
    shadowOpacity: 0.2,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  unarchiveBtnText: {
    fontFamily: AmbitFont.bold,
    fontSize: 12.5,
    color: Brand.inkOnBrand,
  },

  topbar: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    // The header renders inside the FlatList content container, which has
    // its own horizontal padding (see listContent). Cancel it here so the
    // bar is full-bleed and the title/icons sit at Space.lg from the
    // SCREEN edge — matching the Discovery feed's icon X positions.
    marginHorizontal: -18,
    paddingHorizontal: Space.lg,
  },
  topbarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: AmbitFont.display,
    fontSize: 24,
    color: Brand.inkPrimary,
    letterSpacing: -0.5,
  },

  // ── List — flat rows with hairline separators ────────────────
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  sep: {
    height: 1,
    backgroundColor: Brand.borderSoft,
    marginLeft: 18 + 48 + 14, // align past avatar (card pad + avatar + gap)
  },
  sepGap: { height: 12 }, // breathing room below a pending card

  // ── Empty ─────────────────────────────────────────────────────
  empty: {
    marginHorizontal: 4,
    marginTop: 8,
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
    marginTop: 8,
    lineHeight: 19,
  },
});
