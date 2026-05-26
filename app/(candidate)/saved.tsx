import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PaperPlaneTilt, Trash, X } from 'phosphor-react-native';
import { BackChevron } from '../../components/atoms';
import { DiscoveryRowSummary } from '../../components/molecules';
import { useSavedDeck } from '../../context/SavedDeckContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { startConversationWithMessage } from '../../lib/messaging';
import type { DiscoveryCardData } from '../../data/mock';
import {
  AmbitFont,
  Brand,
  Radii,
  Space,
  TypeScale,
} from '../../constants/theme';

/// Mock cards use ids like 'project-1'; real Supabase rows are uuids.
/// Messaging only works on real rows — the placeholder cards predate
/// the matching algorithm and have no corresponding profiles/projects
/// rows to attach a conversation to.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/// Saved list. Reached via the bookmark icon on the Discovery feed.
/// Each row now has two trailing actions: Message (opens a composer
/// modal — sending starts the conversation, unsaves the card, and
/// deep-links into the new thread) and Trash (unsave only).
export default function SavedScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { saved, unsave } = useSavedDeck();

  const [composing, setComposing] = useState<DiscoveryCardData | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const openComposer = (card: DiscoveryCardData) => {
    if (!UUID_RE.test(card.id)) {
      Alert.alert(
        'Demo card',
        "This is a placeholder card — messaging isn't wired for it yet.",
      );
      return;
    }
    setComposing(card);
    setDraft('');
  };

  const dismissComposer = () => {
    if (sending) return;
    setComposing(null);
    setDraft('');
  };

  const send = async () => {
    const text = draft.trim();
    const card = composing;
    if (!text || !card || !user || sending) return;
    setSending(true);
    try {
      let projectId: string;
      let seekerId:  string;

      if (card.kind === 'project') {
        if (!UUID_RE.test(card.ownerId)) {
          Alert.alert(
            'Demo card',
            "This is a placeholder card — messaging isn't wired for it yet.",
          );
          setSending(false);
          return;
        }
        projectId = card.id;
        seekerId  = user.id;
        supabase
          .from('matches')
          .upsert(
            { seeker_id: user.id, project_id: card.id, outcome: 'applied' },
            { onConflict: 'seeker_id,project_id' },
          )
          .then(() => {});
      } else {
        // Owner-saved seeker. Use the owner's first active project as
        // the conversation's project anchor.
        const { data: proj } = await supabase
          .from('projects')
          .select('id')
          .eq('owner_id', user.id)
          .eq('active', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!proj) {
          Alert.alert(
            'No active project',
            'Create a project before reaching out to seekers.',
          );
          setSending(false);
          return;
        }
        projectId = (proj as { id: string }).id;
        seekerId  = card.id;
      }

      // Per-project semantics: each reach-out about a different project
      // gets its own thread. The DB-side ON CONFLICT in
      // start_conversation_with_message handles same-project dedup.
      const conversationId = await startConversationWithMessage({
        projectId,
        seekerId,
        body: text,
      });
      unsave(card.id);
      setComposing(null);
      setDraft('');
      // replace so a Back tap from the thread returns to the feed,
      // not to a stale saved list with the now-unsaved card missing.
      router.replace({ pathname: '/chat/[id]', params: { id: conversationId } });
    } catch (e: any) {
      Alert.alert('Could not send', e?.message ?? 'Try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.root}>
      <BackChevron onPress={() => router.back()} />

      <View style={[styles.header, { marginTop: insets.top + 40 }]}>
        <Text style={styles.headline}>Saved</Text>
        <Text style={styles.subtitle}>
          {saved.length === 0
            ? 'Nothing saved yet — swipe right on someone you like.'
            : `${saved.length} ${saved.length === 1 ? 'pick' : 'picks'} you want to come back to.`}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      >
        {saved.map((card) => (
          <DiscoveryRowSummary
            key={card.id}
            card={card}
            trailing={
              <View style={styles.actions}>
                <Pressable
                  onPress={() => openComposer(card)}
                  hitSlop={6}
                  style={styles.actionBtn}
                  accessibilityLabel={
                    card.kind === 'project'
                      ? `Message ${card.ownerName}`
                      : `Message ${card.name}`
                  }
                >
                  <PaperPlaneTilt size={18} color={Brand.accent} weight="fill" />
                </Pressable>
                <Pressable
                  onPress={() => unsave(card.id)}
                  hitSlop={6}
                  style={styles.actionBtn}
                  accessibilityLabel="Remove from saved"
                >
                  <Trash size={18} color={Brand.inkMuted} weight="regular" />
                </Pressable>
              </View>
            }
          />
        ))}
      </ScrollView>

      <Modal
        visible={!!composing}
        transparent
        animationType="slide"
        onRequestClose={dismissComposer}
      >
        <Pressable style={styles.modalBackdrop} onPress={dismissComposer}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <Pressable style={styles.sheet} onPress={() => {}}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>
                  {composing?.kind === 'project'
                    ? `Message ${composing.ownerName.split(' ')[0]}`
                    : composing?.kind === 'seeker'
                      ? `Message ${composing.name.split(' ')[0]}`
                      : 'Say hi'}
                </Text>
                <Pressable onPress={dismissComposer} hitSlop={10}>
                  <X size={20} color={Brand.inkMuted} weight="bold" />
                </Pressable>
              </View>

              {composing?.kind === 'project' && (
                <Text style={styles.sheetContext} numberOfLines={1}>
                  on {composing.title}
                </Text>
              )}

              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder={
                  composing?.kind === 'project'
                    ? `Tell ${composing.ownerName.split(' ')[0]} what caught your eye…`
                    : composing?.kind === 'seeker'
                      ? `Tell ${composing.name.split(' ')[0]} why you'd be a good fit…`
                      : 'Say hello…'
                }
                placeholderTextColor={Brand.inkPlaceholder}
                multiline
                autoFocus
                editable={!sending}
                style={styles.input}
              />

              <View style={styles.sheetActions}>
                <Pressable
                  onPress={send}
                  disabled={!draft.trim() || sending}
                  style={[
                    styles.sendBtn,
                    (!draft.trim() || sending) && styles.sendBtnDisabled,
                  ]}
                >
                  <PaperPlaneTilt size={16} color={Brand.inkOnBrand} weight="fill" />
                  <Text style={styles.sendLabel}>
                    {sending ? 'Sending…' : 'Send'}
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Brand.canvas,
  },
  header: {
    paddingHorizontal: Space.lg,
    marginBottom: Space.md,
  },
  headline: {
    fontFamily: AmbitFont.display,
    fontSize: 30,
    color: Brand.inkPrimary,
  },
  subtitle: {
    ...TypeScale.body,
    color: Brand.inkMuted,
    marginTop: 8,
  },
  list: {
    paddingHorizontal: Space.lg,
    paddingBottom: 120,
    gap: 10,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Brand.canvas,
    borderTopLeftRadius: Radii.lg,
    borderTopRightRadius: Radii.lg,
    paddingTop: Space.md,
    paddingBottom: 36,
    paddingHorizontal: Space.lg,
    gap: 12,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetTitle: {
    fontFamily: AmbitFont.display,
    fontSize: 20,
    color: Brand.inkPrimary,
  },
  sheetContext: {
    fontFamily: AmbitFont.body,
    fontSize: 13,
    color: Brand.accent,
    marginTop: -8,
  },
  input: {
    minHeight: 100,
    maxHeight: 160,
    backgroundColor: Brand.surface1,
    borderRadius: Radii.md,
    padding: 14,
    fontFamily: AmbitFont.body,
    fontSize: 15,
    color: Brand.inkBody,
    textAlignVertical: 'top',
  },
  sheetActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Brand.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: Radii.md,
  },
  sendBtnDisabled: { opacity: 0.45 },
  sendLabel: {
    fontFamily: AmbitFont.body,
    fontSize: 14,
    fontWeight: '600',
    color: Brand.inkOnBrand,
  },
});
