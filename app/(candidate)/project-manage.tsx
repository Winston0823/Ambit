import React, { useCallback, useState } from 'react';
import {
  Image,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CaretRight, PencilSimple } from 'phosphor-react-native';
import * as Haptics from 'expo-haptics';
import { BackChevron, Skeleton } from '../../components/atoms';
import { getInbox, type InboxItem } from '../../lib/messaging';
import { supabase } from '../../lib/supabase';
import { optimistic } from '../../lib/mutation';
import { AmbitFont, Brand, Radii, Space } from '../../constants/theme';

/// Soft rgba tint of a stage hex — for the per-row wash, stripe, and label.
function tint(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

type Stage = { key: string; label: string; accent: string; statuses: InboxItem['status'][] };

/// Pipeline stages, top → bottom, each with its ASTRA accent (In Conversation =
/// iris, Decision Pending = amber, Hired = emerald, Passed = muted). "Passed"
/// folds in auto_declined since both mean the same thing to the owner: closed.
const STAGES: Stage[] = [
  { key: 'talking',  label: 'In conversation',  accent: '#9975CE', statuses: ['active'] },
  { key: 'decision', label: 'Decision pending',  accent: '#C79A4C', statuses: ['hired_pending'] },
  { key: 'hired',    label: 'Hired',             accent: '#10B981', statuses: ['hired'] },
  { key: 'passed',   label: 'Passed',            accent: '#7B7481', statuses: ['passed', 'auto_declined'] },
];

/// S-025 Project pipeline. The default destination when an owner taps a
/// project — a candidate funnel built from the inbox (every conversation
/// on this project), grouped by status. Editing the project itself is a
/// small secondary action up top.
export default function ProjectManageScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  const [title, setTitle] = useState<string>('');
  const [active, setActive] = useState<boolean>(true);
  const [candidates, setCandidates] = useState<InboxItem[] | null>(null);
  // Invalid deep-link / deleted project → honest error state (mirrors
  // project-edit) instead of an endless skeleton or a blank-titled pipeline.
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!id) {
      setLoadError('This project link is invalid.');
      setCandidates([]);
      return;
    }
    const [{ data: proj, error: projErr }, inbox] = await Promise.all([
      supabase.from('projects').select('title, active').eq('id', id).maybeSingle(),
      getInbox().catch(() => [] as InboxItem[]),
    ]);
    if (projErr || !proj) {
      setLoadError('Project not found. It may have been deleted.');
      setCandidates([]);
      return;
    }
    setLoadError(null);
    setTitle((proj as { title: string }).title);
    setActive((proj as { active: boolean }).active);
    const cands = inbox.filter((i) => i.project_id === id);
    setCandidates(cands);
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }, [load]);

  const toggleActive = async () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    const next = !active;
    await optimistic<boolean>({
      apply: () => { const prev = active; setActive(next); return prev; },
      commit: async () => {
        const { error } = await supabase.from('projects').update({ active: next }).eq('id', id);
        if (error) throw error;
      },
      revert: (prev) => setActive(prev),
      errorMessage: next ? "Couldn't activate this project" : "Couldn't pause this project",
    });
  };

  // Invalid id / not found / deleted → honest error state with a way back,
  // never an endless spinner or a blank-titled pipeline.
  if (loadError) {
    return (
      <View style={[styles.root, styles.center]}>
        <BackChevron onPress={() => router.back()} />
        <View style={styles.errorWrap}>
          <Text style={styles.errorTitle}>Can't open this project</Text>
          <Text style={styles.errorBody}>{loadError}</Text>
          <Pressable onPress={() => router.back()} style={styles.errorBtn} accessibilityRole="button">
            <Text style={styles.errorBtnText}>Go back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (candidates === null) {
    // Mirror the real pipeline: back chevron + header (kicker, title, a status
    // pill + count meta row), then stage groups (label + bordered candidate
    // cards with a 44 avatar). Reuses styles.candidate for an exact row match.
    return (
      <View style={styles.root}>
        <BackChevron onPress={() => router.back()} />
        <View style={[styles.content, { paddingTop: insets.top + 12 }]}>
          <View style={styles.header}>
            <Skeleton width={64} height={11} radius={5} />
            <Skeleton width="70%" height={34} radius={8} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Skeleton width={130} height={32} radius={999} />
              <Skeleton width={90} height={12} radius={6} />
            </View>
          </View>
          {[0, 1].map((s) => (
            <View key={s} style={{ gap: 8 }}>
              <Skeleton width={150} height={11} radius={5} style={{ marginTop: 8 }} />
              {[0, 1].map((r) => (
                <View key={r} style={styles.candidate}>
                  <Skeleton width={44} height={44} radius={14} />
                  <View style={{ flex: 1, gap: 6 }}>
                    <Skeleton width="55%" height={15} radius={6} />
                    <Skeleton width="80%" height={12} radius={6} />
                  </View>
                </View>
              ))}
            </View>
          ))}
        </View>
      </View>
    );
  }

  const total = candidates.length;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 60 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Brand.accent} />}
    >
      <BackChevron onPress={() => router.back()} />

      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={2}>{title || 'Project'}</Text>
          <Pressable
            onPress={() => router.push({ pathname: '/project-edit', params: { id } })}
            hitSlop={8}
            style={styles.editBtn}
            accessibilityRole="button"
            accessibilityLabel="Edit project"
          >
            <PencilSimple size={16} color={Brand.inkHigh} weight="bold" />
            <Text style={styles.editLabel}>Edit</Text>
          </Pressable>
        </View>

        <View style={styles.metaRow}>
          <Pressable
            onPress={toggleActive}
            style={[styles.statusPill, !active && styles.statusPillPaused]}
            accessibilityRole="button"
            accessibilityLabel={active ? 'Pause project' : 'Activate project'}
          >
            <View style={[styles.statusDot, !active && styles.statusDotPaused]} />
            <Text style={[styles.statusText, !active && styles.statusTextPaused]}>
              {active ? 'Live in Discovery' : 'Paused'}
            </Text>
          </Pressable>
          <Text style={styles.countText}>
            {total} {total === 1 ? 'person' : 'people'} in pipeline
          </Text>
        </View>
      </View>

      {total === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No one yet</Text>
          <Text style={styles.emptyBody}>
            {active
              ? 'This project is live — matching seekers see it in Discovery. Replies land here as a pipeline.'
              : "It's paused, so it isn't shown in Discovery. Flip it live to start matching."}
          </Text>
        </View>
      ) : (
        STAGES.map((stage) => {
          const rows = candidates.filter((c) => stage.statuses.includes(c.status));
          if (rows.length === 0) return null;
          const accent = stage.accent;
          return (
            <View key={stage.key} style={styles.stage}>
              <Text style={[styles.stageLabel, { color: accent }]}>
                {stage.label.toUpperCase()} · {rows.length}
              </Text>
              {rows.map((c) => (
                // Each row carries its stage identity: a 3px left accent stripe,
                // a ~7% color wash, and the tinted group label above.
                <Pressable
                  key={c.conversation_id}
                  onPress={() => router.push({ pathname: '/thread/[id]', params: { id: c.conversation_id } })}
                  style={({ pressed }) => [
                    styles.candidate,
                    { backgroundColor: tint(accent, 0.07) },
                    pressed && { opacity: 0.7 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Open chat with ${c.partner_name} — ${stage.label}`}
                >
                  <View style={[styles.stripe, { backgroundColor: accent }]} pointerEvents="none" />
                  {c.partner_photo_url ? (
                    <Image source={{ uri: c.partner_photo_url }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, styles.avatarFallback]}>
                      <Text style={styles.avatarInitial}>
                        {(c.partner_name ?? '?').slice(0, 1).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.candidateText}>
                    <Text style={styles.candidateName} numberOfLines={1}>{c.partner_name}</Text>
                    <Text style={styles.candidateMsg} numberOfLines={1}>
                      {c.last_message_body ?? 'Reached out'}
                    </Text>
                  </View>
                  {c.unread_count > 0 && (
                    <View style={styles.unreadDot}>
                      <Text style={styles.unreadText}>{c.unread_count}</Text>
                    </View>
                  )}
                  <CaretRight size={18} color={Brand.inkPlaceholder} weight="bold" />
                </Pressable>
              ))}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.canvas },
  center: { alignItems: 'center', justifyContent: 'center' },
  errorWrap: { paddingHorizontal: 40, alignItems: 'center' },
  errorTitle: { fontFamily: AmbitFont.display, fontSize: 24, color: Brand.inkPrimary, textAlign: 'center' },
  errorBody: { fontFamily: AmbitFont.body, fontSize: 14.5, color: Brand.inkMuted, textAlign: 'center', marginTop: 12, lineHeight: 21 },
  errorBtn: {
    marginTop: 28,
    backgroundColor: Brand.action,
    borderWidth: 1.6,
    borderColor: Brand.actionInk,
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 999,
  },
  errorBtnText: { fontFamily: AmbitFont.body, fontSize: 15, fontWeight: '700', color: Brand.actionInk },
  skelRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Brand.borderSoft },
  content: { paddingHorizontal: Space.lg, gap: Space.md },

  // marginTop clears the absolutely-positioned BackChevron so the title sits
  // on its own row below it (the "PIPELINE" eyebrow used to occupy this line).
  header: { gap: 12, marginTop: 40 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  title: {
    flex: 1,
    fontFamily: AmbitFont.display,
    fontSize: 34,
    color: Brand.inkPrimary,
    lineHeight: 40,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Brand.surface1,
    marginTop: 4,
  },
  editLabel: {
    fontFamily: AmbitFont.body,
    fontSize: 13,
    fontWeight: '600',
    color: Brand.inkHigh,
  },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Brand.tagMint,
  },
  statusPillPaused: { backgroundColor: Brand.surface2 },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Brand.tagMintInk },
  statusDotPaused: { backgroundColor: Brand.inkMuted },
  statusText: {
    fontFamily: AmbitFont.body,
    fontSize: 12,
    fontWeight: '700',
    color: Brand.tagMintInk,
  },
  statusTextPaused: { color: Brand.inkLabel },
  countText: { fontFamily: AmbitFont.body, fontSize: 12, color: Brand.inkMuted },

  empty: {
    backgroundColor: Brand.surface1,
    borderRadius: Radii.lg,
    padding: Space.lg,
    marginTop: Space.sm,
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

  stage: { gap: 8 },
  stageLabel: {
    fontFamily: AmbitFont.body,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
    color: Brand.inkLabel,
    marginTop: 8,
  },
  candidate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingRight: 12,
    paddingLeft: 15, // clears the 3px stripe + 12 gutter
    borderRadius: Radii.md,
    overflow: 'hidden', // clip the stripe to the rounded corners
    // Soft-shadow card (ASTRA pipeline rows).
    shadowColor: '#0C0022',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  stripe: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  avatar: { width: 44, height: 44, borderRadius: Radii.md },
  avatarFallback: {
    backgroundColor: Brand.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { fontFamily: AmbitFont.display, fontSize: 18, color: Brand.inkLabel },
  candidateText: { flex: 1 },
  candidateName: {
    fontFamily: AmbitFont.body,
    fontSize: 15,
    fontWeight: '600',
    color: Brand.inkHigh,
  },
  candidateMsg: {
    fontFamily: AmbitFont.body,
    fontSize: 13,
    color: Brand.inkMuted,
    marginTop: 2,
  },
  unreadDot: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 8,
    backgroundColor: Brand.action,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadText: {
    fontFamily: AmbitFont.body,
    fontSize: 11,
    fontWeight: '700',
    color: Brand.actionInk,
  },
});
