import React, { useRef, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PaperPlaneTilt, Trash, X } from 'phosphor-react-native';
import { BackChevron } from '../../components/atoms';
import { DiscoveryCard, DiscoveryRowSummary, ReachOutComposer } from '../../components/molecules';
import { useSavedDeck } from '../../context/SavedDeckContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { sendProjectAttachment, startConversationWithMessage } from '../../lib/messaging';
import type { DiscoveryCardData } from '../../data/mock';
import {
  AmbitFont,
  Brand,
  Space,
  TypeScale,
} from '../../constants/theme';

/// Mock cards use ids like 'project-1'; real Supabase rows are uuids.
/// Messaging only works on real rows.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/// Saved list. Reached via the bookmark icon on the Discovery feed. Each
/// row has Message (opens the shared ReachOutComposer — sending starts the
/// conversation, unsaves the card, and deep-links into the thread) and
/// Trash (unsave only). Reusing ReachOutComposer keeps the reach-out
/// experience identical to the feed (paper-plane celebration + all).
export default function SavedScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { saved, unsave } = useSavedDeck();

  /// Card currently targeted by the composer. Null = closed.
  const [composing, setComposing] = useState<DiscoveryCardData | null>(null);
  /// Card being previewed full-screen (tapped from the list). Null = closed.
  const [previewing, setPreviewing] = useState<DiscoveryCardData | null>(null);
  /// Holds the result of a confirmed send so onSent can unsave + navigate.
  const lastSent = useRef<{ card: DiscoveryCardData; conversationId: string } | null>(null);

  const openComposer = (card: DiscoveryCardData) => {
    if (!UUID_RE.test(card.id)) {
      Alert.alert(
        'Demo card',
        "This is a placeholder card — messaging isn't wired for it yet.",
      );
      return;
    }
    setComposing(card);
  };

  /// Performs the send and returns true/false. The composer awaits this and
  /// only celebrates on success; navigation + unsave happen in handleSent.
  const handleSend = async (
    card: DiscoveryCardData,
    text: string,
    attachment?: { id: string; title: string } | null,
  ): Promise<boolean> => {
    if (!user) return false;
    try {
      let projectId: string;
      let seekerId: string;

      if (card.kind === 'project') {
        if (!UUID_RE.test(card.ownerId)) {
          Alert.alert('Demo card', "This is a placeholder card — messaging isn't wired for it yet.");
          return false;
        }
        projectId = card.id;
        seekerId = user.id;
        supabase
          .from('matches')
          .upsert(
            { seeker_id: user.id, project_id: card.id, outcome: 'applied' },
            { onConflict: 'seeker_id,project_id' },
          )
          .then(() => {});
      } else {
        // Owner-saved seeker → anchor on the owner's first active project.
        const { data: proj } = await supabase
          .from('projects')
          .select('id')
          .eq('owner_id', user.id)
          .eq('active', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!proj) {
          Alert.alert('No active project', 'Create a project before reaching out to seekers.');
          return false;
        }
        projectId = (proj as { id: string }).id;
        seekerId = card.id;
      }

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
      lastSent.current = { card, conversationId };
      return true;
    } catch {
      return false;
    }
  };

  /// Confirmed send — unsave the card and deep-link into the new thread.
  /// replace() so a Back tap returns to the feed, not a stale saved list.
  const handleSent = () => {
    const sent = lastSent.current;
    setComposing(null);
    if (!sent) return;
    unsave(sent.card.id);
    router.replace({ pathname: '/chat/[id]', params: { id: sent.conversationId } });
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
            onPress={() => setPreviewing(card)}
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

      {/* Full-card preview — tapping a saved row opens the same rich
          DiscoveryCard the deck shows, here with an X to dismiss. Reaching
          out from the preview closes it and opens the composer. */}
      <Modal
        visible={!!previewing}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewing(null)}
      >
        <View style={styles.previewRoot}>
          <View
            style={[
              styles.previewCardWrap,
              { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 },
            ]}
          >
            {previewing && (
              <DiscoveryCard
                key={previewing.id}
                card={previewing}
                onReachOut={(c) => {
                  setPreviewing(null);
                  openComposer(c);
                }}
              />
            )}
          </View>

          <Pressable
            onPress={() => setPreviewing(null)}
            hitSlop={8}
            style={[styles.previewClose, { top: insets.top + 22 }]}
            accessibilityRole="button"
            accessibilityLabel="Close preview"
          >
            <X size={20} color="#FFFFFF" weight="bold" />
          </Pressable>
        </View>
      </Modal>

      <ReachOutComposer
        card={composing}
        onDismiss={() => setComposing(null)}
        onSend={handleSend}
        onSent={handleSent}
      />
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

  // ── Full-card preview ──────────────────────────────────────────
  previewRoot: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  previewCardWrap: {
    flex: 1,
    paddingHorizontal: Space.lg,
  },
  previewClose: {
    position: 'absolute',
    left: Space.lg + 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    zIndex: 10,
  },
});
