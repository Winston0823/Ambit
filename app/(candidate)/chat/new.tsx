import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MagnifyingGlass, X, CaretRight } from 'phosphor-react-native';
import { BackChevron, Chip } from '../../../components/atoms';
import { BottomSheet, ReachOutComposer } from '../../../components/molecules';
import { supabase } from '../../../lib/supabase';
import { startConversationWithMessage } from '../../../lib/messaging';
import { useAuth } from '../../../context/AuthContext';
import { CAMPUSES, type SeekerCardData } from '../../../data/mock';
import { AmbitFont, Brand, Radii, Space } from '../../../constants/theme';

/// S-051 People search. Find another user by display name, preview their
/// profile card, then reach out about one of *your* active projects —
/// every conversation is project-anchored, so the project the user picks
/// becomes the thread's context and the searched person becomes the
/// seeker on it.
interface Person {
  id:         string;
  name:       string;
  photo_url:  string | null;
  campus_id:  string | null;
  skills:     string[] | null;
  vibe_blurb: string | null;
}

interface MyProject {
  id:    string;
  title: string;
}

const campusName = (id: string | null): string | null =>
  CAMPUSES.find((c) => c.id === id)?.name ?? null;

export default function NewChatScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Person[] | null>(null);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Person whose card is being previewed in the modal. Null = closed.
  const [selected, setSelected] = useState<Person | null>(null);

  // Project picker state — surfaced when the user has >1 active project.
  const [pickerProjects, setPickerProjects] = useState<MyProject[] | null>(null);

  // Card handed to the ReachOutComposer. Non-null = composer open. We
  // stash the chosen project id alongside so onSend can anchor the thread.
  const [reachCard, setReachCard] = useState<SeekerCardData | null>(null);
  const chosenProjectId = useRef<string | null>(null);

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

  // ── Reach out: resolve which project anchors the new thread ────
  const beginReachOut = async (person: Person) => {
    if (!user) return;
    const { data } = await supabase
      .from('projects')
      .select('id, title')
      .eq('owner_id', user.id)
      .eq('active', true)
      .order('created_at', { ascending: false });

    const projects = (data as MyProject[] | null) ?? [];

    if (projects.length === 0) {
      Alert.alert(
        'No active project',
        'Create a project before reaching out — every chat is about a project.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'New project', onPress: () => router.push('/project-new') },
        ],
      );
      return;
    }

    if (projects.length === 1) {
      openComposer(person, projects[0].id);
      return;
    }

    // Multiple active projects → let the user choose which one.
    setPickerProjects(projects);
  };

  const openComposer = (person: Person, projectId: string) => {
    chosenProjectId.current = projectId;
    setPickerProjects(null);
    setSelected(null);
    setReachCard({
      kind:      'seeker',
      id:        person.id,
      name:      person.name,
      photoUri:  person.photo_url,
      campusId:  person.campus_id ?? '',
      skills:    person.skills ?? [],
      vibeBlurb: person.vibe_blurb ?? '',
      portfolio: [],
    });
  };

  // Holds the new conversation id from a confirmed send so onSent can
  // navigate after the composer's success affirmation.
  const lastConvId = useRef<string | null>(null);

  const handleSend = async (card: SeekerCardData, text: string): Promise<boolean> => {
    const projectId = chosenProjectId.current;
    if (!projectId) return false;
    try {
      const conversationId = await startConversationWithMessage({
        projectId,
        seekerId: card.id,
        body:     text,
      });
      lastConvId.current = conversationId;
      return true;
    } catch {
      return false;
    }
  };

  const handleSent = () => {
    setReachCard(null);
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
            Search for someone by name, then reach out about one of your projects.
          </Text>
        </View>
      ) : searching ? (
        <View style={styles.center}>
          <ActivityIndicator color={Brand.accent} />
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
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setSelected(item)}
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
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

      {/* Profile preview — bottom sheet (Luma-style). */}
      <BottomSheet visible={!!selected} onClose={() => setSelected(null)}>
        {selected && (
          <View style={styles.cardContent}>
            {selected.photo_url ? (
              <Image source={{ uri: selected.photo_url }} style={styles.cardAvatar} />
            ) : (
              <View style={[styles.cardAvatar, styles.rowAvatarFallback]}>
                <Text style={styles.cardAvatarInitial}>
                  {(selected.name ?? '?').slice(0, 1).toUpperCase()}
                </Text>
              </View>
            )}
            <Text style={styles.cardName}>{selected.name}</Text>
            {campusName(selected.campus_id) && (
              <Text style={styles.cardCampus}>{campusName(selected.campus_id)}</Text>
            )}
            {selected.vibe_blurb ? (
              <Text style={styles.cardVibe}>{selected.vibe_blurb}</Text>
            ) : null}
            {selected.skills && selected.skills.length > 0 && (
              <View style={styles.chipRow}>
                {selected.skills.map((s) => (
                  <Chip key={s} label={s} selected={false} onPress={() => {}} />
                ))}
              </View>
            )}
            <Pressable
              style={({ pressed }) => [styles.reachBtn, pressed && { opacity: 0.9 }]}
              onPress={() => beginReachOut(selected)}
              accessibilityRole="button"
              accessibilityLabel={`Reach out to ${selected.name}`}
            >
              <Text style={styles.reachBtnLabel}>Reach out</Text>
            </Pressable>
          </View>
        )}
      </BottomSheet>

      {/* Project picker — bottom sheet, only when the user has >1 active project */}
      <BottomSheet visible={!!pickerProjects} onClose={() => setPickerProjects(null)}>
        <Text style={styles.pickerTitle}>Reach out about…</Text>
        {(pickerProjects ?? []).map((p) => (
          <Pressable
            key={p.id}
            style={({ pressed }) => [styles.pickerRow, pressed && { opacity: 0.7 }]}
            onPress={() => selected && openComposer(selected, p.id)}
            accessibilityRole="button"
            accessibilityLabel={`Reach out about ${p.title}`}
          >
            <Text style={styles.pickerRowText} numberOfLines={1}>{p.title}</Text>
            <CaretRight size={15} color={Brand.inkLabel} weight="regular" />
          </Pressable>
        ))}
      </BottomSheet>

      <ReachOutComposer
        card={reachCard}
        onDismiss={() => setReachCard(null)}
        onSend={(card, text) => handleSend(card as SeekerCardData, text)}
        onSent={handleSent}
      />
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
    backgroundColor: Brand.surface1,
    paddingHorizontal: 14,
    paddingVertical: 10,
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

  sep: { height: 1, backgroundColor: Brand.borderDefault, marginLeft: Space.lg + 48 + 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: Space.lg,
    paddingVertical: 12,
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

  // ── Profile preview (bottom sheet content) ────────────────────
  cardContent: { alignItems: 'center', gap: 10, paddingTop: 4, paddingBottom: Space.md },
  cardAvatar: { width: 96, height: 96, borderRadius: 24 },
  cardAvatarInitial: { fontFamily: AmbitFont.display, fontSize: 36, color: Brand.inkLabel },
  cardName: {
    fontFamily: AmbitFont.display,
    fontSize: 22,
    color: Brand.seekerInk,
    textAlign: 'center',
  },
  cardCampus: { fontFamily: AmbitFont.body, fontSize: 13, color: Brand.inkLabel },
  cardVibe: {
    fontFamily: AmbitFont.body,
    fontSize: 14,
    color: Brand.inkBody,
    lineHeight: 20,
    textAlign: 'center',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  reachBtn: {
    marginTop: 12,
    alignSelf: 'stretch',
    backgroundColor: Brand.primary,
    paddingVertical: 14,
    borderRadius: Radii.md,
    alignItems: 'center',
  },
  reachBtnLabel: {
    fontFamily: AmbitFont.body,
    fontSize: 15,
    fontWeight: '700',
    color: Brand.inkOnBrand,
  },

  // ── Project picker (bottom sheet content) ─────────────────────
  pickerTitle: {
    fontFamily: AmbitFont.display,
    fontSize: 18,
    color: Brand.seekerInk,
    marginBottom: 6,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: Brand.surface1,
    borderRadius: Radii.md,
    gap: 10,
  },
  pickerRowText: {
    flex: 1,
    fontFamily: AmbitFont.body,
    fontSize: 15,
    fontWeight: '600',
    color: Brand.inkBody,
  },
});
