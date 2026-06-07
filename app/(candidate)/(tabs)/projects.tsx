import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ChatCircle,
  Compass,
  Handshake,
  PencilSimple,
  Plus,
} from 'phosphor-react-native';
import { useAuth } from '../../../context/AuthContext';
import { useProfileRole } from '../../../hooks/useProfileRole';
import { supabase } from '../../../lib/supabase';
import { getInbox, type InboxItem } from '../../../lib/messaging';
import { SwipeRevealRow } from '../../../components/molecules/SwipeRevealRow';
import { HardShadow, Skeleton } from '../../../components/atoms';
import { AmbitFont, Brand, Radii, Space } from '../../../constants/theme';

interface ProjectRow {
  id: string;
  title: string;
  vibe_blurb: string;
  required_skills: string[];
  active: boolean;
  created_at: string;
}

/// Per-project accent rails — gives each card a distinct identity instead of
/// a uniform grey ledger. Keyed by index so order is stable per render.
const RAILS: [string, string][] = [
  [Brand.primary, Brand.accent],
  ['#C9A57A', Brand.seekerInk],
  ['#E8C9A0', Brand.primary],
  [Brand.accent, '#7A5A38'],
  ['#D4B490', '#4D361D'],
];

const engagementLabel = (status: InboxItem['status']): string => {
  switch (status) {
    case 'active':        return 'In conversation';
    case 'hired':         return 'Hired';
    case 'hired_pending': return 'Decision pending';
    case 'passed':        return 'Closed';
    case 'auto_declined': return 'Closed';
    default:              return '';
  }
};

/// S-024 Your Projects — owner command center. Each owned project is a
/// dashboard card (live-in-Discovery marker + pipeline stats + interested
/// faces); tapping opens the candidate pipeline, swiping left reveals Edit.
/// Role-aware: pure seekers instead see the projects they're engaging with.
export default function ProjectsTab() {
  const { user } = useAuth();
  const { role } = useProfileRole();
  const isPureSeeker = role === 'seeker';
  const insets = useSafeAreaInsets();

  const [projects, setProjects] = useState<ProjectRow[] | null>(null);
  const [inbox, setInbox] = useState<InboxItem[]>([]);

  const load = useCallback(async () => {
    if (!user) {
      setProjects([]);
      setInbox([]);
      return;
    }
    const [{ data }, ib] = await Promise.all([
      supabase
        .from('projects')
        .select('id, title, vibe_blurb, required_skills, active, created_at')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false }),
      getInbox().catch(() => [] as InboxItem[]),
    ]);
    setProjects((data ?? []) as ProjectRow[]);
    setInbox(ib);
  }, [user?.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (projects === null) {
    return (
      <View style={styles.root}>
        <View style={[styles.content, { paddingTop: insets.top + 40 }]}>
          <Skeleton width={60} height={12} radius={6} />
          <Skeleton width={180} height={34} radius={10} style={{ marginTop: 12, marginBottom: 24 }} />
          <Skeleton height={52} radius={999} style={{ marginBottom: 20 }} />
          {[0, 1].map((i) => (
            <View key={i} style={styles.skelCard}>
              <View style={styles.skelHeader}>
                <Skeleton width={110} height={20} radius={6} />
                <Skeleton width={46} height={18} radius={999} />
              </View>
              <Skeleton width="68%" height={13} radius={6} style={{ marginTop: 12 }} />
            </View>
          ))}
        </View>
      </View>
    );
  }

  const myProjectIds = new Set(projects.map((p) => p.id));
  // Conversations where I'm the seeker on someone else's project.
  const exploring = inbox.filter((i) => !myProjectIds.has(i.project_id));

  const ownerInbox = inbox.filter((i) => myProjectIds.has(i.project_id));
  const activeCount = projects.filter((p) => p.active).length;
  const interested = ownerInbox.length;
  const unreadTotal = ownerInbox.reduce((n, i) => n + i.unread_count, 0);

  const statsFor = (projectId: string) => {
    const items = ownerInbox.filter((i) => i.project_id === projectId);
    return {
      total: items.length,
      talking: items.filter((i) => i.status === 'active').length,
      hired: items.filter((i) => i.status === 'hired' || i.status === 'hired_pending').length,
      unread: items.reduce((n, i) => n + i.unread_count, 0),
      avatars: items.slice(0, 4).map((i) => i.partner_photo_url),
    };
  };

  const summary = isPureSeeker
    ? `${exploring.length} ${exploring.length === 1 ? 'project' : 'projects'} in motion`
    : [
        `${activeCount} ${activeCount === 1 ? 'active' : 'active'}`,
        `${interested} interested`,
        unreadTotal > 0 ? `${unreadTotal} unread` : null,
      ].filter(Boolean).join(' · ');

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 40 }]}
    >
      <Text style={styles.kicker}>{isPureSeeker ? 'YOUR HUSTLE' : 'YOURS'}</Text>
      <Text style={styles.title}>{isPureSeeker ? 'Projects you’re in' : 'Your projects'}</Text>
      {summary !== '' && <Text style={styles.summary}>{summary}</Text>}

      <HardShadow radius={999} offset={4} style={styles.newBtnWrap}>
        <Pressable
          onPress={() => router.push(isPureSeeker ? '/feed' : '/project-new')}
          style={styles.newBtn}
          accessibilityRole="button"
          accessibilityLabel={isPureSeeker ? 'Find a new project' : 'New project'}
        >
          {isPureSeeker ? (
            <Compass size={18} color={Brand.actionInk} weight="bold" />
          ) : (
            <Plus size={18} color={Brand.actionInk} weight="bold" />
          )}
          <Text style={styles.newBtnLabel}>{isPureSeeker ? 'Find new project' : 'New project'}</Text>
        </Pressable>
      </HardShadow>

      {/* ── Owner dashboard ────────────────────────────────────── */}
      {!isPureSeeker && (
        projects.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Nothing here yet</Text>
            <Text style={styles.emptyBody}>
              Start a project to share what you&apos;re building. Seekers with the right skills surface in your discovery feed.
            </Text>
          </View>
        ) : (
          projects.map((p, idx) => {
            const s = statsFor(p.id);
            return (
              <HardShadow key={p.id} radius={Radii.card} offset={4}>
              <SwipeRevealRow
                radius={Radii.card}
                onPress={() => router.push({ pathname: '/project-manage', params: { id: p.id } })}
                renderReveal={(close) => (
                  <Pressable
                    onPress={() => { close(); router.push({ pathname: '/project-edit', params: { id: p.id } }); }}
                    style={styles.editReveal}
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${p.title}`}
                  >
                    <PencilSimple size={20} color={Brand.inkOnBrand} weight="bold" />
                    <Text style={styles.editRevealText}>Edit</Text>
                  </Pressable>
                )}
              >
                <View style={styles.card}>
                  <View style={styles.cardBody}>
                    <View style={styles.cardHeader}>
                      <Text style={styles.cardTitle} numberOfLines={1}>{p.title}</Text>
                      {p.active ? (
                        <View style={styles.liveBadge}>
                          <View style={styles.liveDot} />
                          <Text style={styles.liveText}>LIVE</Text>
                        </View>
                      ) : (
                        <View style={[styles.statusPill, styles.statusPillPaused]}>
                          <Text style={[styles.statusText, styles.statusTextPaused]}>
                            Paused
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Single calm summary line (Vocabulary restraint) */}
                    <Text style={styles.cardSummary}>
                      {[
                        `${s.talking} in conversation`,
                        s.total > 0 ? `${s.total} interested` : null,
                        s.unread > 0 ? `${s.unread} new` : null,
                      ].filter(Boolean).join('  ·  ') ||
                        (p.active ? 'Live and matching' : 'Paused')}
                    </Text>
                  </View>
                </View>
              </SwipeRevealRow>
              </HardShadow>
            );
          })
        )
      )}

      {/* ── Seeker engagements (their side of the funnel) ─────────── */}
      {(isPureSeeker || exploring.length > 0) && (
        <View style={styles.exploreSection}>
          {!isPureSeeker && <Text style={styles.sectionLabel}>ALSO EXPLORING</Text>}
          {exploring.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No projects yet</Text>
              <Text style={styles.emptyBody}>
                Swipe through Discovery and reach out — projects you start a conversation about show up here.
              </Text>
            </View>
          ) : (
            exploring.map((item) => (
              <Pressable
                key={item.conversation_id}
                onPress={() => router.push({ pathname: '/chat/[id]', params: { id: item.conversation_id } })}
                style={({ pressed }) => [styles.engRow, pressed && { opacity: 0.7 }]}
                accessibilityRole="button"
                accessibilityLabel={`Open ${item.project_title}`}
              >
                {item.partner_photo_url ? (
                  <Image source={{ uri: item.partner_photo_url }} style={styles.engAvatar} />
                ) : (
                  <View style={[styles.engAvatar, styles.engAvatarFallback]}>
                    <Text style={styles.engInitial}>{(item.partner_name ?? '?').slice(0, 1).toUpperCase()}</Text>
                  </View>
                )}
                <View style={styles.engText}>
                  <Text style={styles.engTitle} numberOfLines={1}>{item.project_title}</Text>
                  <Text style={styles.engSub} numberOfLines={1}>
                    {engagementLabel(item.status)} · {item.partner_name}
                  </Text>
                </View>
                {item.unread_count > 0 && <View style={styles.engUnread} />}
              </Pressable>
            ))
          )}
        </View>
      )}

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

/// Overlapping avatar stack for "who's interested."
function AvatarStack({ uris }: { uris: (string | null)[] }) {
  return (
    <View style={styles.stack}>
      {uris.map((uri, i) => (
        <View key={i} style={[styles.stackAvatarWrap, { marginLeft: i === 0 ? 0 : -10, zIndex: 10 - i }]}>
          {uri ? (
            <Image source={{ uri }} style={styles.stackAvatar} />
          ) : (
            <View style={[styles.stackAvatar, styles.engAvatarFallback]} />
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.canvas },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: Space.lg, paddingTop: Space.lg, gap: Space.md },

  // Skeleton (loading) cards — shaped like the real project cards.
  skelCard: { backgroundColor: Brand.cardCream, borderWidth: 1.5, borderColor: Brand.borderSoft, borderRadius: Radii.card, padding: 20 },
  skelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  kicker: {
    fontFamily: AmbitFont.body,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.6,
    color: Brand.inkMuted,
  },
  title: {
    fontFamily: AmbitFont.display,
    fontSize: 34,
    color: Brand.inkPrimary,
    marginTop: -12,
  },
  summary: {
    fontFamily: AmbitFont.body,
    fontSize: 13,
    color: Brand.inkMuted,
    marginTop: -8,
  },

  newBtnWrap: { marginTop: 4 },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    backgroundColor: Brand.action,
    borderWidth: 1.6,
    borderColor: Brand.actionInk,
    borderRadius: 999,
  },
  newBtnLabel: {
    fontFamily: AmbitFont.body,
    fontSize: 15,
    fontWeight: '700',
    color: Brand.actionInk,
  },

  empty: {
    backgroundColor: Brand.surface1,
    borderRadius: Radii.lg,
    padding: Space.lg,
    marginTop: Space.sm,
  },
  emptyTitle: { fontFamily: AmbitFont.body, fontSize: 16, fontWeight: '600', color: Brand.inkHigh },
  emptyBody: { fontFamily: AmbitFont.body, fontSize: 13, color: Brand.inkMuted, marginTop: 8, lineHeight: 19 },

  // ── Edit reveal (behind a swiped card) ─────────────────────────
  editReveal: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: Brand.accent,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  editRevealText: {
    fontFamily: AmbitFont.body,
    fontSize: 12,
    fontWeight: '700',
    color: Brand.inkOnBrand,
  },

  // ── Project card ───────────────────────────────────────────────
  card: {
    flexDirection: 'row',
    backgroundColor: Brand.cardCream,
    borderRadius: Radii.card,
    borderWidth: 1.5,
    borderColor: Brand.inkEdge,
    // The hard offset edge is provided by the <HardShadow> wrapper (a crisp
    // solid block) — SwipeRevealRow clips, so an RN shadow here never showed.
  },
  cardBody: { flex: 1, padding: 20, gap: 8 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardTitle: {
    flex: 1,
    fontFamily: AmbitFont.display,
    fontSize: 20,
    color: Brand.inkPrimary,
  },
  cardSummary: {
    fontFamily: AmbitFont.body,
    fontSize: 13,
    color: Brand.inkMuted,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: Brand.tagMint,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Brand.tagMintInk },
  liveText: {
    fontFamily: AmbitFont.body,
    fontSize: 10,
    fontWeight: '800',
    color: Brand.tagMintInk,
    letterSpacing: 0.6,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.sm,
    backgroundColor: Brand.primary,
  },
  statusPillPaused: { backgroundColor: Brand.surface2 },
  statusText: {
    fontFamily: AmbitFont.body,
    fontSize: 10,
    fontWeight: '600',
    color: Brand.inkOnBrand,
    letterSpacing: 0.4,
  },
  statusTextPaused: { color: Brand.inkLabel },

  statRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontFamily: AmbitFont.body, fontSize: 13, color: Brand.inkBody, fontWeight: '600' },
  unreadPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: Brand.accent,
  },
  unreadPillText: {
    fontFamily: AmbitFont.body,
    fontSize: 11,
    fontWeight: '700',
    color: Brand.inkOnBrand,
  },

  facesRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  facesText: { fontFamily: AmbitFont.body, fontSize: 12, color: Brand.inkMuted },
  facesEmpty: { fontFamily: AmbitFont.body, fontSize: 12, color: Brand.inkPlaceholder },

  stack: { flexDirection: 'row' },
  stackAvatarWrap: { borderRadius: 13, borderWidth: 2, borderColor: Brand.cardCream },
  stackAvatar: { width: 22, height: 22, borderRadius: 11, backgroundColor: Brand.surface2 },

  // ── Seeker engagements ─────────────────────────────────────────
  exploreSection: { gap: 12, marginTop: Space.sm },
  sectionLabel: {
    fontFamily: AmbitFont.body,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
    color: Brand.inkLabel,
  },
  engRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: Brand.cardCream,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Brand.borderSoft,
  },
  engAvatar: { width: 44, height: 44, borderRadius: 14 },
  engAvatarFallback: { backgroundColor: Brand.surface2, alignItems: 'center', justifyContent: 'center' },
  engInitial: { fontFamily: AmbitFont.display, fontSize: 18, color: Brand.inkLabel },
  engText: { flex: 1 },
  engTitle: { fontFamily: AmbitFont.body, fontSize: 15, fontWeight: '600', color: Brand.inkHigh },
  engSub: { fontFamily: AmbitFont.body, fontSize: 13, color: Brand.inkMuted, marginTop: 2 },
  engUnread: { width: 10, height: 10, borderRadius: 5, backgroundColor: Brand.accent },
});
