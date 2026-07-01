import React, { useCallback, useState } from 'react';
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { PencilSimple } from 'phosphor-react-native';
import * as Haptics from 'expo-haptics';
import { BackChevron, Skeleton } from '../../components/atoms';
import { getInbox, type InboxItem } from '../../lib/messaging';
import { supabase } from '../../lib/supabase';
import { optimistic } from '../../lib/mutation';
import { OWNER_STAGES, type OwnerStage } from '../../lib/closureLoop';
import { AmbitFont, Brand, Radii, Space, StageColor } from '../../constants/theme';

const STAGE_LABEL: Record<OwnerStage, string> = Object.fromEntries(
  OWNER_STAGES.map((s) => [s.value, s.label]),
) as Record<OwnerStage, string>;

/// Soft rgba tint of a stage hex — for the per-row pipeline gradient + chip.
function tint(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

type Stage = { key: string; label: string; statuses: InboxItem['status'][] };

/// Pipeline stages, top → bottom. "Passed" folds in auto_declined since
/// both mean the same thing to the owner: this one's closed.
const STAGES: Stage[] = [
  { key: 'talking',  label: 'In conversation', statuses: ['active'] },
  { key: 'decision', label: 'Decision pending', statuses: ['hired_pending'] },
  { key: 'hired',    label: 'Hired',            statuses: ['hired'] },
  { key: 'passed',   label: 'Passed',           statuses: ['passed', 'auto_declined'] },
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
  // Private funnel stage per conversation (owner's CRM tag). Not carried by the
  // inbox RPC, so fetched directly — owner can read it via conversations RLS.
  const [stageMap, setStageMap] = useState<Record<string, OwnerStage>>({});

  const load = useCallback(async () => {
    if (!id) return;
    const [{ data: proj }, inbox] = await Promise.all([
      supabase.from('projects').select('title, active').eq('id', id).maybeSingle(),
      getInbox().catch(() => [] as InboxItem[]),
    ]);
    if (proj) {
      setTitle((proj as { title: string }).title);
      setActive((proj as { active: boolean }).active);
    }
    const cands = inbox.filter((i) => i.project_id === id);
    setCandidates(cands);

    const ids = cands.map((c) => c.conversation_id);
    if (ids.length > 0) {
      const { data: rows } = await supabase
        .from('conversations')
        .select('id, owner_stage')
        .in('id', ids);
      const map: Record<string, OwnerStage> = {};
      (rows ?? []).forEach((r: any) => { if (r.owner_stage) map[r.id] = r.owner_stage; });
      setStageMap(map);
    } else {
      setStageMap({});
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

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
          return (
            <View key={stage.key} style={styles.stage}>
              <Text style={styles.stageLabel}>
                {stage.label.toUpperCase()} · {rows.length}
              </Text>
              {rows.map((c) => {
                // The owner's private funnel stage (defaults to New until moved)
                // → a left-clean → right-tinted gradient + a stage chip, so the
                // pipeline reads each candidate's stage at a glance.
                const ownerStage = stageMap[c.conversation_id] ?? 'new';
                const sc = StageColor[ownerStage];
                return (
                <Pressable
                  key={c.conversation_id}
                  onPress={() => router.push({ pathname: '/chat/[id]', params: { id: c.conversation_id } })}
                  style={({ pressed }) => [styles.candidate, pressed && { opacity: 0.7 }]}
                  accessibilityRole="button"
                  accessibilityLabel={`Open chat with ${c.partner_name} — stage ${STAGE_LABEL[ownerStage]}`}
                >
                  <LinearGradient
                    colors={['transparent', tint(sc, 0.22)]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    locations={[0.35, 1]}
                    style={StyleSheet.absoluteFill}
                    pointerEvents="none"
                  />
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
                  {/* Stage indicator at the right of the listing. */}
                  <View style={[styles.stageChip, { backgroundColor: tint(sc, 0.18) }]}>
                    <View style={[styles.stageChipDot, { backgroundColor: sc }]} />
                    <Text style={styles.stageChipText}>{STAGE_LABEL[ownerStage]}</Text>
                  </View>
                </Pressable>
              );
              })}
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
    padding: 12,
    backgroundColor: Brand.cardCream,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Brand.borderSoft,
    overflow: 'hidden', // clip the stage gradient to the rounded corners
  },
  stageChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
  },
  stageChipDot: { width: 7, height: 7, borderRadius: 4 },
  stageChipText: {
    fontFamily: AmbitFont.body,
    fontSize: 11,
    fontWeight: '700',
    color: Brand.inkBody,
    letterSpacing: 0.2,
  },
  avatar: { width: 44, height: 44, borderRadius: 14 },
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
