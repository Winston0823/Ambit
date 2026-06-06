import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
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
import { PencilSimple } from 'phosphor-react-native';
import * as Haptics from 'expo-haptics';
import { BackChevron, Skeleton } from '../../components/atoms';
import { getInbox, type InboxItem } from '../../lib/messaging';
import { supabase } from '../../lib/supabase';
import { AmbitFont, Brand, Radii, Space } from '../../constants/theme';

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
    setCandidates(inbox.filter((i) => i.project_id === id));
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggleActive = async () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    const next = !active;
    setActive(next);
    await supabase.from('projects').update({ active: next }).eq('id', id);
  };

  if (candidates === null) {
    return (
      <View style={styles.root}>
        <View style={{ paddingHorizontal: 24, paddingTop: insets.top + 64 }}>
          <Skeleton width={60} height={12} radius={6} />
          <Skeleton width={200} height={30} radius={8} style={{ marginTop: 10, marginBottom: 28 }} />
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.skelRow}>
              <Skeleton width={48} height={48} radius={14} />
              <View style={{ flex: 1, gap: 9 }}>
                <Skeleton width="55%" height={16} radius={6} />
                <Skeleton width="80%" height={12} radius={6} />
              </View>
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
        <Text style={styles.kicker}>Pipeline</Text>
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
              {rows.map((c) => (
                <Pressable
                  key={c.conversation_id}
                  onPress={() => router.push({ pathname: '/chat/[id]', params: { id: c.conversation_id } })}
                  style={({ pressed }) => [styles.candidate, pressed && { opacity: 0.7 }]}
                  accessibilityRole="button"
                  accessibilityLabel={`Open chat with ${c.partner_name}`}
                >
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
  skelRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Brand.borderSoft },
  content: { paddingHorizontal: Space.lg, gap: Space.md },

  header: { gap: 10, marginTop: 8 },
  kicker: {
    fontFamily: AmbitFont.body,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: Brand.accent,
  },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  title: {
    flex: 1,
    fontFamily: AmbitFont.display,
    fontSize: 30,
    color: Brand.inkPrimary,
    lineHeight: 36,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
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
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Brand.seekerSurface,
  },
  statusPillPaused: { backgroundColor: Brand.surface2 },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Brand.sage },
  statusDotPaused: { backgroundColor: Brand.inkMuted },
  statusText: {
    fontFamily: AmbitFont.body,
    fontSize: 12,
    fontWeight: '600',
    color: Brand.seekerInk,
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
    marginTop: 6,
    lineHeight: 19,
  },

  stage: { gap: 8 },
  stageLabel: {
    fontFamily: AmbitFont.body,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
    color: Brand.inkLabel,
    marginTop: 6,
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
    paddingHorizontal: 6,
    backgroundColor: Brand.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadText: {
    fontFamily: AmbitFont.body,
    fontSize: 11,
    fontWeight: '700',
    color: Brand.inkOnBrand,
  },
});
