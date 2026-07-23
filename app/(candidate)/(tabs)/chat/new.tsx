import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MagnifyingGlass, X, CaretRight } from 'phosphor-react-native';
import { Avatar, BackChevron, GlassSurface, Skeleton } from '../../../../components/atoms';
import { DiscoveryCard, ReachOutComposer } from '../../../../components/molecules';
import { supabase } from '../../../../lib/supabase';
import { sendProjectAttachment, startConversationWithMessage } from '../../../../lib/messaging';
import { fetchPeerPhotos } from '../../../../lib/photoReveal';
import { canReachOut, recordReachOut } from '../../../../lib/reachOutLimit';
import { fetchPortfoliosByUser } from '../../../../lib/portfolio';
import { useAuth } from '../../../../context/AuthContext';
import { type SeekerCardData } from '../../../../data/mock';
import { AmbitFont, Brand, Radii, Space } from '../../../../constants/theme';
import { toast } from '../../../../lib/toast';

/// S-051 People search. Find another user by display name, preview the same
/// discovery card an owner would see, then reach out. Every conversation is
/// project-anchored and the OWNER party is whoever owns that project — so we
/// don't gate on the searcher's role. A chat can be anchored on *either*
/// side's active project:
///   - one of MY active projects → the other person joins as the seeker
///   - one of THEIR active projects → I join as the seeker
/// If multiple projects qualify the user picks; only when neither side has an
/// active project is there nothing to anchor on (the DB has no project-less DM).
interface Person {
  id:             string;
  name:           string;
  avatar_id:      string | null;
  open_to_nearby: boolean | null;
  skills:         string[] | null;
  vibe_blurb:     string | null;
}

interface ProjectRow {
  id:    string;
  title: string;
}

/// A concrete way to start the thread: which project anchors it and, derived
/// from that project's owner, who is owner vs seeker on the new conversation.
const cardFromPerson = (p: Person, portfolio: SeekerCardData['portfolio'] = []): SeekerCardData => ({
  kind:         'seeker',
  id:           p.id,
  name:         p.name,
  avatarId:     p.avatar_id ?? 'monster-01',
  openToNearby: p.open_to_nearby ?? null,
  skills:       p.skills ?? [],
  vibeBlurb:    p.vibe_blurb ?? '',
  portfolio,
});

export default function NewChatScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Person[] | null>(null);
  /// Revealed real photos keyed by person id — mutual conversations only.
  /// A search row with no entry renders the monster mark.
  const [revealed, setRevealed] = useState<Map<string, string>>(new Map());
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The person being acted on (preview + reach-out flow).
  const [selected, setSelected] = useState<Person | null>(null);
  // Full discovery card for the previewed person — null = preview closed.
  // Built from the search row immediately; portfolio is patched in async.
  const [previewCard, setPreviewCard] = useState<SeekerCardData | null>(null);

  // Card handed to the ReachOutComposer. Non-null = composer open.
  const [reachCard, setReachCard] = useState<SeekerCardData | null>(null);
  // Guards the reach-out button against a double-tap firing two project
  // lookups (and potentially two composers) before the first resolves.
  const [reachingOut, setReachingOut] = useState(false);
  const chosenProjectId = useRef<string | null>(null);
  // Seeker on the new thread — derived from the chosen project's owner.
  const chosenSeekerId = useRef<string | null>(null);

  // ── Name search (stable so the error-toast Retry can re-run it) ────────
  const runSearch = useCallback(async (term: string) => {
    setSearching(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, avatar_id, open_to_nearby, skills, vibe_blurb')
        .ilike('name', `%${term}%`)
        .neq('id', user?.id ?? '')
        .limit(30);
      if (error) throw error;
      const people = (data as Person[] | null) ?? [];
      setResults(people);
      // One batched reveal fetch for the search hits — a photo comes back
      // only for someone you already share a mutual thread with; everyone
      // else stays a monster mark. Never throws.
      setRevealed(await fetchPeerPhotos(people.map((p) => p.id)));
    } catch {
      // A failed search must not read as "No one found." Keep prior results
      // (or the empty prompt) and surface a retryable error.
      setResults((prev) => prev ?? null);
      toast.error("Couldn't search right now.", {
        actionLabel: 'Retry',
        onAction: () => { void runSearch(term); },
      });
    } finally {
      setSearching(false);
    }
  }, [user?.id]);

  // ── Debounced trigger ──────────────────────────────────────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const term = query.trim();
    if (term.length < 2) {
      setResults(null);
      return;
    }
    debounceRef.current = setTimeout(() => { void runSearch(term); }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, runSearch]);

  // ── Open the full discovery card for a tapped result ───────────
  const openPreview = async (person: Person) => {
    setSelected(person);
    setPreviewCard(cardFromPerson(person));
    // Pull their portfolio so the card's second page is real, not empty.
    try {
      const map = await fetchPortfoliosByUser([person.id]);
      const portfolio = map.get(person.id) ?? [];
      if (portfolio.length) {
        setPreviewCard((c) => (c && c.id === person.id ? { ...c, portfolio } : c));
      }
    } catch { /* keep the card without portfolio */ }
  };

  const closePreview = () => {
    setPreviewCard(null);
    setSelected(null);
  };

  // ── Reach out: collect every project that could anchor this chat ──
  // No role gate — a chat can hang off one of my projects (they're the
  // seeker) OR one of theirs (I'm the seeker), so anyone can reach anyone.
  const beginReachOut = async (person: Person) => {
    if (!user || reachingOut) return;
    setReachingOut(true);
    try {
    // Same daily cap as Discovery — without this, the chat "+" flow would
    // bypass the reach-out limit entirely.
    if (!(await canReachOut())) {
      toast.error('No reach-outs left today — resets tomorrow.');
      return;
    }
    const [mineRes, theirsRes] = await Promise.all([
      supabase.from('projects').select('id, title')
        .eq('owner_id', user.id).eq('active', true)
        .order('created_at', { ascending: false }),
      supabase.from('projects').select('id, title')
        .eq('owner_id', person.id).eq('active', true)
        .order('created_at', { ascending: false }),
    ]);
    if (mineRes.error || theirsRes.error) {
      toast.error("Couldn't start that reach-out.", {
        actionLabel: 'Retry',
        onAction: () => { void beginReachOut(person); },
      });
      return;
    }
    const mine   = (mineRes.data   as ProjectRow[] | null) ?? [];
    const theirs = (theirsRes.data as ProjectRow[] | null) ?? [];

    if (mine.length === 0 && theirs.length === 0) {
      Alert.alert(
        'Nothing to anchor on',
        `Every chat hangs off a project, and neither you nor ${person.name} has an active one yet. Post a project to start the conversation.`,
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'New project', onPress: () => router.push('/project-new') },
        ],
      );
      return;
    }

    // Anchor silently on the most recent project — mine first (they're the
    // seeker), else theirs (I'm the seeker) — mirroring Discovery, where the
    // owner→seeker composer never asks. Attaching a project in the composer
    // stays optional and re-anchors the chat on the attached project.
    if (mine.length > 0) {
      chosenProjectId.current = mine[0].id;
      chosenSeekerId.current  = person.id;
    } else {
      chosenProjectId.current = theirs[0].id;
      chosenSeekerId.current  = user.id;
    }
    setReachCard(cardFromPerson(person));
    } finally {
      setReachingOut(false);
    }
  };

  // Holds the new conversation id from a confirmed send so onSent can
  // navigate after the composer's success affirmation.
  const lastConvId = useRef<string | null>(null);

  const handleSend = async (
    _card: SeekerCardData,
    text: string,
    attachment?: { id: string; title: string } | null,
  ): Promise<boolean> => {
    let projectId = chosenProjectId.current;
    let seekerId  = chosenSeekerId.current;
    // An attached project is one of MY projects — anchor the chat on it so
    // the thread hangs off the project the note is actually about.
    if (attachment && selected) {
      projectId = attachment.id;
      seekerId  = selected.id;
    }
    if (!projectId || !seekerId || !user) return false;
    try {
      const conversationId = await startConversationWithMessage({
        projectId,
        seekerId,
        body: text,
      });
      if (attachment) {
        await sendProjectAttachment({
          conversationId,
          senderId: user.id,
          projectId: attachment.id,
          projectTitle: attachment.title,
        }).catch(() => {});
      }
      lastConvId.current = conversationId;
      recordReachOut().catch(() => {});
      return true;
    } catch {
      return false;
    }
  };

  const handleSent = () => {
    setReachCard(null);
    setPreviewCard(null);
    setSelected(null);
    if (lastConvId.current) {
      router.replace({ pathname: '/chat/[id]', params: { id: lastConvId.current } });
    }
  };

  return (
    <View style={styles.root}>
      <BackChevron onPress={() => router.back()} />

      <Text style={[styles.headerTitle, { marginTop: insets.top + 14 }]}>New chat</Text>

      <GlassSurface hairline intensity={20} style={[styles.searchBar, { marginTop: 20 }]}>
        <MagnifyingGlass size={18} color={Brand.inkMuted} weight="regular" />
        <TextInput
          autoFocus
          value={query}
          onChangeText={setQuery}
          placeholder="Search people by name…"
          placeholderTextColor={Brand.inkPlaceholder}
          style={styles.input}
          returnKeyType="search"
          accessibilityLabel="Search people by name"
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityLabel="Clear search">
            <X size={16} color={Brand.inkMuted} weight="bold" />
          </Pressable>
        )}
      </GlassSurface>

      {results === null ? (
        <View style={styles.empty}>
          <Text style={styles.emptyBody}>
            Search for someone by name to start a conversation.
          </Text>
        </View>
      ) : searching ? (
        <View style={styles.results}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={styles.rowCard}>
              <Skeleton width={48} height={48} radius={14} />
              <View style={{ flex: 1, gap: 8 }}>
                <Skeleton width="42%" height={15} radius={6} />
                <Skeleton width="72%" height={12} radius={6} />
              </View>
              <Skeleton width={8} height={14} radius={3} />
            </View>
          ))}
        </View>
      ) : results.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No one found</Text>
          <Text style={styles.emptyBody}>Try a different spelling or name.</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.results}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <Pressable
              onPress={() => openPreview(item)}
              style={({ pressed }) => [styles.rowCard, pressed && { opacity: 0.7 }]}
              accessibilityRole="button"
              accessibilityLabel={`View ${item.name}'s profile`}
            >
              <Avatar avatarId={item.avatar_id} photoUrl={revealed.get(item.id) ?? null} size={48} />
              <View style={styles.rowText}>
                <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.rowMeta} numberOfLines={1}>
                  {(item.skills ?? []).slice(0, 2).join('  ·  ') || 'On Ambit'}
                </Text>
              </View>
              <CaretRight size={16} color={Brand.inkLabel} weight="regular" />
            </Pressable>
          )}
        />
      )}

      {/* Full-screen discovery card preview — the same card seen in the deck. */}
      <Modal
        visible={!!previewCard}
        animationType="slide"
        onRequestClose={closePreview}
      >
        <View style={[styles.previewRoot, { paddingTop: insets.top + 6 }]}>
          <View style={styles.previewBar}>
            <Pressable onPress={closePreview} hitSlop={10} style={styles.previewClose} accessibilityLabel="Close">
              <X size={22} color={Brand.inkPrimary} weight="bold" />
            </Pressable>
          </View>
          <View style={styles.previewCardWrap}>
            {previewCard && (
              <DiscoveryCard
                card={previewCard}
                onReachOut={() => selected && beginReachOut(selected)}
              />
            )}
          </View>

          {/* Composer renders INSIDE the preview modal so it overlays the
              card (same as Discovery). As a sibling outside, it presented
              behind the already-open preview — invisible until you backed out. */}

          <ReachOutComposer
            card={reachCard}
            onDismiss={() => setReachCard(null)}
            onSend={(card, text, attachment) => handleSend(card as SeekerCardData, text, attachment)}
            onSent={handleSent}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.canvas },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    textAlign: 'center',
    fontFamily: AmbitFont.display,
    fontSize: 17,
    color: Brand.inkPrimary,
    letterSpacing: -0.2,
  },

  // Glass search bar — GlassSurface provides the blur/fill + purple hairline.
  searchBar: {
    marginHorizontal: Space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
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
    marginHorizontal: Space.lg,
    marginTop: Space.lg,
    padding: Space.lg,
    backgroundColor: Brand.surface1,
    borderRadius: Radii.lg,
    gap: 8,
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

  results: { paddingHorizontal: Space.lg, paddingTop: 12 },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Brand.cardCream,
    borderWidth: 1,
    borderColor: Brand.borderSoft,
    borderRadius: Radii.lg,
    padding: 12,
    marginBottom: 12,
  },
  rowAvatar: { width: 48, height: 48, borderRadius: 14 },
  rowAvatarFallback: {
    backgroundColor: Brand.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowAvatarInitial: { fontFamily: AmbitFont.display, fontSize: 20, color: Brand.inkLabel },
  rowText: { flex: 1 },
  rowName: {
    fontFamily: AmbitFont.body,
    fontSize: 15,
    fontWeight: '600',
    color: Brand.inkPrimary,
  },
  rowMeta: {
    fontFamily: AmbitFont.body,
    fontSize: 12,
    color: Brand.inkMuted,
    marginTop: 2,
  },

  // ── Full-screen card preview ──────────────────────────────────
  previewRoot: { flex: 1, backgroundColor: Brand.canvas },
  previewBar: {
    height: 44,
    justifyContent: 'center',
    paddingHorizontal: Space.md,
  },
  previewClose: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -8,
  },
  previewCardWrap: {
    flex: 1,
    paddingHorizontal: Space.lg,
    paddingTop: 4,
    paddingBottom: Space.lg,
  },

});
