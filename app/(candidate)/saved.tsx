import React, { useRef, useState } from 'react';
import {
  Alert,
  Animated,
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
import { Swipeable } from 'react-native-gesture-handler';
import { NotePencil, PaperPlaneTilt, Trash, X } from 'phosphor-react-native';
import { BackChevron, HardShadow, Tactile } from '../../components/atoms';
import { DiscoveryCard, DiscoveryRowSummary, ReachOutComposer, ReachOutLimitSheet, SavedCarousel } from '../../components/molecules';
import { Motion } from '../../constants/motion';
import { haptics } from '../../lib/haptics';
import { useSavedDeck } from '../../context/SavedDeckContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { sendProjectAttachment, startConversationWithMessage } from '../../lib/messaging';
import {
  canReachOut,
  recordReachOut,
  getReachOutStatus,
} from '../../lib/reachOutLimit';
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
  const { saved, unsave, save, notes, setNote } = useSavedDeck();

  /// Card currently targeted by the composer. Null = closed.
  const [composing, setComposing] = useState<DiscoveryCardData | null>(null);
  /// Card being previewed full-screen (tapped from the list). Null = closed.
  const [previewing, setPreviewing] = useState<DiscoveryCardData | null>(null);
  /// Holds the result of a confirmed send so onSent can unsave + navigate.
  const lastSent = useRef<{ card: DiscoveryCardData; conversationId: string } | null>(null);

  // Daily reach-out limit state.
  const [limitSheetVisible, setLimitSheetVisible] = useState(false);
  const [limitStatus, setLimitStatus] = useState<{ used: number; limit: number }>({ used: 0, limit: 5 });
  const [pendingCompose, setPendingCompose] = useState<DiscoveryCardData | null>(null);

  // ── Swipe-to-remove + Undo ──────────────────────────────────────────
  const swipeableRefs = useRef<Record<string, Swipeable | null>>({});
  /// Which row is currently open (revealed Remove).
  const openRowRef = useRef<string | null>(null);
  /// True briefly while/after a swipe opens a row, so the swipe's trailing
  /// press is swallowed (the row stays open) instead of opening the preview.
  const justSwipedRef = useRef(false);

  /// Tap semantics: ignore the press that trails a swipe; a deliberate tap on
  /// an open row closes it; a clean tap on a closed row previews.
  const handleRowPress = (card: DiscoveryCardData) => {
    if (justSwipedRef.current) return;
    const openId = openRowRef.current;
    if (openId) {
      swipeableRefs.current[openId]?.close();
      openRowRef.current = null;
      return;
    }
    setPreviewing(card);
  };
  const [undoCard, setUndoCard] = useState<DiscoveryCardData | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastAnim = useRef(new Animated.Value(0)).current;

  const hideUndo = () => {
    Animated.timing(toastAnim, { toValue: 0, duration: 200, useNativeDriver: true })
      .start(() => setUndoCard(null));
  };
  const removeWithUndo = (card: DiscoveryCardData) => {
    haptics.tap();
    swipeableRefs.current[card.id]?.close();
    unsave(card.id);
    setUndoCard(card);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    Animated.spring(toastAnim, { toValue: 1, ...Motion.spring, useNativeDriver: true }).start();
    undoTimer.current = setTimeout(hideUndo, 4000);
  };
  const undoRemove = () => {
    if (undoCard) save(undoCard);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    hideUndo();
  };

  // ── Notes ("sticky note") ───────────────────────────────────────────
  const [noteEditing, setNoteEditing] = useState<DiscoveryCardData | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const openNote = (card: DiscoveryCardData) => {
    setNoteDraft(notes[card.id] ?? '');
    setNoteEditing(card);
  };
  const saveNote = () => {
    if (noteEditing) setNote(noteEditing.id, noteDraft);
    setNoteEditing(null);
  };

  const openComposer = async (card: DiscoveryCardData) => {
    if (!UUID_RE.test(card.id)) {
      Alert.alert(
        'Demo card',
        "This is a placeholder card — messaging isn't wired for it yet.",
      );
      return;
    }
    const ok = await canReachOut();
    if (!ok) {
      const status = await getReachOutStatus();
      setLimitStatus(status);
      setPendingCompose(card);
      setLimitSheetVisible(true);
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
      recordReachOut().catch(() => {});
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
        {saved.length >= 3 && (
          <View style={styles.carouselBleed}>
            <SavedCarousel cards={[...saved].reverse().slice(0, 8)} onPress={setPreviewing} />
          </View>
        )}
        {saved.map((card) => (
          <Swipeable
            key={card.id}
            ref={(r) => { swipeableRefs.current[card.id] = r; }}
            friction={2}
            rightThreshold={44}
            overshootRight={false}
            onSwipeableWillOpen={() => {
              openRowRef.current = card.id;
              justSwipedRef.current = true;
              setTimeout(() => { justSwipedRef.current = false; }, 500);
            }}
            onSwipeableClose={() => { if (openRowRef.current === card.id) openRowRef.current = null; }}
            renderRightActions={() => (
              <Pressable
                onPress={() => removeWithUndo(card)}
                style={styles.swipeRemove}
                accessibilityLabel="Remove from saved"
              >
                <Trash size={20} color={Brand.inkOnBrand} weight="bold" />
                <Text style={styles.swipeRemoveText}>Remove</Text>
              </Pressable>
            )}
          >
            <View style={styles.savedItem}>
              <DiscoveryRowSummary
                card={card}
                onPress={() => handleRowPress(card)}
                trailing={
                  <View style={styles.actions}>
                    <Pressable
                      onPress={() => openComposer(card)}
                      hitSlop={6}
                      style={styles.actionBtn}
                      accessibilityLabel={
                        card.kind === 'project' ? `Message ${card.ownerName}` : `Message ${card.name}`
                      }
                    >
                      <PaperPlaneTilt size={18} color={Brand.accent} weight="fill" />
                    </Pressable>
                    <Pressable
                      onPress={() => openNote(card)}
                      hitSlop={6}
                      style={styles.actionBtn}
                      accessibilityLabel={notes[card.id] ? 'Edit note' : 'Add a note'}
                    >
                      <NotePencil
                        size={18}
                        color={notes[card.id] ? Brand.accent : Brand.inkMuted}
                        weight={notes[card.id] ? 'fill' : 'regular'}
                      />
                    </Pressable>
                  </View>
                }
              />
              {notes[card.id] ? (
                <Pressable onPress={() => openNote(card)} style={styles.noteTag}>
                  <NotePencil size={12} color={Brand.accent} weight="fill" />
                  <Text style={styles.noteTagText} numberOfLines={2}>{notes[card.id]}</Text>
                </Pressable>
              ) : null}
            </View>
          </Swipeable>
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
            <X size={20} color={Brand.inkOnBrand} weight="bold" />
          </Pressable>
        </View>
      </Modal>

      <ReachOutComposer
        card={composing}
        onDismiss={() => setComposing(null)}
        onSend={handleSend}
        onSent={handleSent}
      />

      <ReachOutLimitSheet
        visible={limitSheetVisible}
        used={limitStatus.used}
        limit={limitStatus.limit}
        onDismiss={() => {
          setLimitSheetVisible(false);
          setPendingCompose(null);
        }}
        onAdComplete={() => {
          setLimitSheetVisible(false);
          if (pendingCompose) setComposing(pendingCompose);
          setPendingCompose(null);
        }}
      />

      {/* Undo toast — appears after a swipe-remove, re-saves on tap. */}
      {undoCard ? (
        <Animated.View
          pointerEvents="box-none"
          style={[styles.toastWrap, { bottom: insets.bottom + 16 }]}
        >
          <HardShadow radius={999} offset={4}>
          <Animated.View
            style={[
              styles.toast,
              { opacity: toastAnim, transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] },
            ]}
          >
            <Text style={styles.toastText}>Removed from saved</Text>
            <Tactile haptic="tap" onPress={undoRemove} style={styles.toastBtn} accessibilityLabel="Undo remove">
              <Text style={styles.toastBtnText}>Undo</Text>
            </Tactile>
          </Animated.View>
          </HardShadow>
        </Animated.View>
      ) : null}

      {/* Private note editor. */}
      <Modal visible={!!noteEditing} transparent animationType="fade" onRequestClose={() => setNoteEditing(null)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.noteModalRoot}
        >
          <Pressable style={styles.noteScrim} onPress={() => setNoteEditing(null)} />
          <View style={styles.noteSheet}>
            <View style={styles.noteHead}>
              <Text style={styles.noteTitle}>Private note</Text>
              <Pressable onPress={() => setNoteEditing(null)} hitSlop={10}>
                <X size={20} color={Brand.inkMuted} weight="bold" />
              </Pressable>
            </View>
            <Text style={styles.noteHint}>Only you can see this — jot why you saved them.</Text>
            <TextInput
              value={noteDraft}
              onChangeText={setNoteDraft}
              placeholder="e.g. strong RN portfolio — ping after midterms"
              placeholderTextColor={Brand.inkPlaceholder}
              style={styles.noteInput}
              multiline
              maxLength={160}
              autoFocus
            />
            <HardShadow radius={999} offset={4} style={styles.noteSaveWrap}>
              <Tactile haptic="tap" onPress={saveNote} style={styles.noteSave}>
                <Text style={styles.noteSaveText}>{noteDraft.trim() ? 'Save note' : 'Clear note'}</Text>
              </Tactile>
            </HardShadow>
          </View>
        </KeyboardAvoidingView>
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
    gap: 12,
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

  // Full-bleed the carousel past the list's horizontal padding.
  carouselBleed: { marginHorizontal: -Space.lg },

  // ── Swipe-to-remove + note ─────────────────────────────────────
  savedItem: { backgroundColor: Brand.canvas },
  swipeRemove: {
    width: 92,
    marginLeft: 8,
    borderRadius: 16,
    backgroundColor: Brand.danger,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  swipeRemoveText: { fontFamily: AmbitFont.body, fontSize: 12, fontWeight: '700', color: Brand.inkOnBrand },
  noteTag: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 8,
    marginLeft: 56,
    marginRight: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Brand.seekerSurface,
  },
  noteTagText: { flex: 1, fontFamily: AmbitFont.body, fontSize: 12.5, color: Brand.seekerInk, lineHeight: 17 },

  // ── Undo toast ─────────────────────────────────────────────────
  toastWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingLeft: 20,
    paddingRight: 8,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Brand.inkPrimary,
    borderWidth: 1.5,
    borderColor: Brand.inkEdge,
  },
  toastText: { fontFamily: AmbitFont.body, fontSize: 14, fontWeight: '600', color: Brand.canvas },
  toastBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, backgroundColor: Brand.action },
  toastBtnText: { fontFamily: AmbitFont.body, fontSize: 14, fontWeight: '700', color: Brand.actionInk },

  // ── Note editor sheet ──────────────────────────────────────────
  noteModalRoot: { flex: 1, justifyContent: 'flex-end' },
  noteScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  noteSheet: {
    backgroundColor: Brand.canvas,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Space.lg,
    paddingBottom: Space.lg + 8,
    gap: 12,
  },
  noteHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  noteTitle: { fontFamily: AmbitFont.display, fontSize: 20, color: Brand.inkPrimary },
  noteHint: { fontFamily: AmbitFont.body, fontSize: 13, color: Brand.inkMuted },
  noteInput: {
    minHeight: 80,
    maxHeight: 160,
    borderRadius: 14,
    padding: 16,
    backgroundColor: Brand.surface1,
    fontFamily: AmbitFont.body,
    fontSize: 15,
    color: Brand.inkBody,
    textAlignVertical: 'top',
  },
  noteSaveWrap: { alignSelf: 'stretch', marginTop: 4 },
  noteSave: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 999,
    backgroundColor: Brand.action,
    borderWidth: 1.6,
    borderColor: Brand.actionInk,
  },
  noteSaveText: { fontFamily: AmbitFont.body, fontSize: 15, fontWeight: '700', color: Brand.actionInk },

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
