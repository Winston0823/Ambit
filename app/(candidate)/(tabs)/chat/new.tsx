import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
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
import { BackChevron, Skeleton } from '../../../../components/atoms';
import { BottomSheet, DiscoveryCard, ReachOutComposer } from '../../../../components/molecules';
import { supabase } from '../../../../lib/supabase';
import { sendProjectAttachment, startConversationWithMessage } from '../../../../lib/messaging';
import { fetchPortfoliosByUser } from '../../../../lib/portfolio';
import { useAuth } from '../../../../context/AuthContext';
import { CAMPUSES, type SeekerCardData } from '../../../../data/mock';
import { AmbitFont, Brand, Radii, Space } from '../../../../constants/theme';

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
  id:         string;
  name:       string;
  photo_url:  string | null;
  campus_id:  string | null;
  skills:     string[] | null;
  vibe_blurb: string | null;
}

interface ProjectRow {
  id:    string;
  title: string;
}

/// A concrete way to start the thread: which project anchors it and, derived
/// from that project's owner, who is owner vs seeker on the new conversation.
interface ReachOption {
  projectId: string;
  title:     string;
  seekerId:  string;  // the party that is NOT the project owner
  mine:      boolean;  // true = my project (they join), false = their project (I join)
}

const cardFromPerson = (p: Person, portfolio: SeekerCardData['portfolio'] = []): SeekerCardData => ({
  kind:      'seeker',
  id:        p.id,
  name:      p.name,
  photoUri:  p.photo_url,
  campusId:  p.campus_id ?? '',
  skills:    p.skills ?? [],
  vibeBlurb: p.vibe_blurb ?? '',
  portfolio,
});

const campusName = (id: string | null): string | null =>
  CAMPUSES.find((c) => c.id === id)?.name ?? null;

export default function NewChatScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Person[] | null>(null);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The person being acted on (preview + reach-out flow).
  const [selected, setSelected] = useState<Person | null>(null);
  // Full discovery card for the previewed person — null = preview closed.
  // Built from the search row immediately; portfolio is patched in async.
  const [previewCard, setPreviewCard] = useState<SeekerCardData | null>(null);

  // Project picker — surfaced when more than one project could anchor the chat.
  const [pickerOptions, setPickerOptions] = useState<ReachOption[] | null>(null);

  // Card handed to the ReachOutComposer. Non-null = composer open.
  const [reachCard, setReachCard] = useState<SeekerCardData | null>(null);
  const chosenProjectId = useRef<string | null>(null);
  // Seeker on the new thread — derived from the chosen project's owner.
  const chosenSeekerId = useRef<string | null>(null);

  // ── Debounced name search ──────────────────────────────────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults(null);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await supabase
          .from('profiles')
          .select('id, name, photo_url, campus_id, skills, vibe_blurb')
          .ilike('name', `%${query.trim()}%`)
          .neq('id', user?.id ?? '')
          .limit(30);
        setResults((data as Person[] | null) ?? []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, user?.id]);

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
    if (!user) return;
    const [mineRes, theirsRes] = await Promise.all([
      supabase.from('projects').select('id, title')
        .eq('owner_id', user.id).eq('active', true)
        .order('created_at', { ascending: false }),
      supabase.from('projects').select('id, title')
        .eq('owner_id', person.id).eq('active', true)
        .order('created_at', { ascending: false }),
    ]);
    const mine   = (mineRes.data   as ProjectRow[] | null) ?? [];
    const theirs = (theirsRes.data as ProjectRow[] | null) ?? [];

    const options: ReachOption[] = [
      ...mine.map((p)   => ({ projectId: p.id, title: p.title, seekerId: person.id, mine: true })),
      ...theirs.map((p) => ({ projectId: p.id, title: p.title, seekerId: user.id,  mine: false })),
    ];

    if (options.length === 0) {
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

    if (options.length === 1) {
      openComposer(person, options[0]);
      return;
    }
    setPickerOptions(options);
  };

  const openComposer = (person: Person, option: ReachOption) => {
    chosenProjectId.current = option.projectId;
    chosenSeekerId.current  = option.seekerId;
    setPickerOptions(null);
    // Keep `previewCard` mounted — the composer is a transparent sheet that
    // sits over the card, so the person's card stays visible behind it.
    setReachCard(cardFromPerson(person));
  };

  // Holds the new conversation id from a confirmed send so onSent can
  // navigate after the composer's success affirmation.
  const lastConvId = useRef<string | null>(null);

  const handleSend = async (
    _card: SeekerCardData,
    text: string,
    attachment?: { id: string; title: string } | null,
  ): Promise<boolean> => {
    const projectId = chosenProjectId.current;
    const seekerId  = chosenSeekerId.current;
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

      <View style={[styles.searchBar, { marginTop: 18 }]}>
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
      </View>

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
                <Skeleton width="50%" height={15} radius={6} />
                <Skeleton width="75%" height={12} radius={6} />
              </View>
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
              {item.photo_url ? (
                <Image source={{ uri: item.photo_url }} style={styles.rowAvatar} />
              ) : (
                <View style={[styles.rowAvatar, styles.rowAvatarFallback]}>
                  <Text style={styles.rowAvatarInitial}>
                    {(item.name ?? '?').slice(0, 1).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.rowText}>
                <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.rowMeta} numberOfLines={1}>
                  {[campusName(item.campus_id), (item.skills ?? []).slice(0, 2).join(' · ')]
                    .filter(Boolean)
                    .join('  ·  ') || 'On Ambit'}
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

          {/* Picker + composer render INSIDE the preview modal so they overlay
              the card (same as Discovery). As siblings outside, they presented
              behind the already-open preview — invisible until you backed out. */}
          <BottomSheet visible={!!pickerOptions} onClose={() => setPickerOptions(null)}>
        <Text style={styles.pickerTitle}>Reach out about…</Text>
        {(pickerOptions ?? []).map((opt) => (
          <Pressable
            key={opt.projectId}
            style={({ pressed }) => [styles.pickerRow, pressed && { opacity: 0.7 }]}
            onPress={() => selected && openComposer(selected, opt)}
            accessibilityRole="button"
            accessibilityLabel={`Reach out about ${opt.title}`}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.pickerRowText} numberOfLines={1}>{opt.title}</Text>
              <Text style={styles.pickerRowSub} numberOfLines={1}>
                {opt.mine ? 'Your project' : `${selected?.name ?? 'Their'}’s project`}
              </Text>
            </View>
            <CaretRight size={15} color={Brand.inkLabel} weight="regular" />
          </Pressable>
        ))}
      </BottomSheet>

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

  empty: { paddingHorizontal: Space.lg, paddingTop: Space.xl, gap: 6 },
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
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Brand.cardCream,
    borderWidth: 1,
    borderColor: Brand.borderSoft,
    borderRadius: Radii.lg,
    padding: 12,
    marginBottom: 10,
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

  // ── Project picker (bottom sheet content) ─────────────────────
  pickerTitle: {
    fontFamily: AmbitFont.display,
    fontSize: 18,
    color: Brand.inkPrimary,
    marginBottom: 6,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: Brand.cardCream,
    borderWidth: 1,
    borderColor: Brand.borderSoft,
    borderRadius: Radii.md,
    gap: 10,
    marginTop: 8,
  },
  pickerRowText: {
    fontFamily: AmbitFont.body,
    fontSize: 15,
    fontWeight: '600',
    color: Brand.inkBody,
  },
  pickerRowSub: {
    fontFamily: AmbitFont.body,
    fontSize: 12,
    color: Brand.inkMuted,
    marginTop: 2,
  },
});
