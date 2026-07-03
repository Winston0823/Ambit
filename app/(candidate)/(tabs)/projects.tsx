import React, { useCallback, useState } from 'react';
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowClockwise,
  Compass,
  PencilSimple,
  Plus,
} from 'phosphor-react-native';
import { useAuth } from '../../../context/AuthContext';
import { useProfileRole } from '../../../hooks/useProfileRole';
import { supabase } from '../../../lib/supabase';
import { getInbox, type InboxItem } from '../../../lib/messaging';
import { formatResponseRate } from '../../../lib/closureLoop';
import { SwipeRevealRow } from '../../../components/molecules/SwipeRevealRow';
import { HardShadow, Skeleton, TopAppBar } from '../../../components/atoms';
import { AmbitFont, Astra, Brand, Radii, Space, TypeScale } from '../../../constants/theme';

interface ProjectRow {
  id: string;
  title: string;
  vibe_blurb: string;
  required_skills: string[];
  active: boolean;
  created_at: string;
  image_url: string | null;
}

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
/// dashboard card (royal→iris gradient cover + live badge + collaborator
/// faces); tapping opens the candidate pipeline, swiping left reveals Edit.
/// Role-aware: pure seekers instead see the projects they're engaging with.
export default function ProjectsTab() {
  const { user } = useAuth();
  const { role } = useProfileRole();
  const isPureSeeker = role === 'seeker';
  const insets = useSafeAreaInsets();

  const [projects, setProjects] = useState<ProjectRow[] | null>(null);
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  // A real read failure (network / RLS) — distinct from "no projects yet" — so
  // an outage shows an error+retry instead of the empty-state copy.
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // Owner's real reply-within-72h rate (0–1) from profiles.response_rate.
  // One value for all their cards — it measures the founder, not the project.
  // null = no reach-outs aged past the 72h window yet → chip is hidden.
  const [myRate, setMyRate] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setProjects([]);
      setInbox([]);
      setMyRate(null);
      setLoadError(false);
      return;
    }
    const [projRes, ib, prof] = await Promise.all([
      supabase
        .from('projects')
        .select('id, title, vibe_blurb, required_skills, active, created_at, image_url')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false }),
      getInbox().catch(() => [] as InboxItem[]),
      supabase
        .from('profiles')
        .select('response_rate')
        .eq('id', user.id)
        .maybeSingle(),
    ]);
    // A failed read is NOT "no projects" — surface it as an error state so we
    // never show the empty-state CTA over an outage.
    if (projRes.error) {
      console.warn('projects fetch failed:', projRes.error.message);
      setLoadError(true);
      setProjects([]);
      setInbox([]);
      setMyRate(null);
      return;
    }
    setLoadError(false);
    setProjects((projRes.data ?? []) as ProjectRow[]);
    setInbox(ib);
    setMyRate((prof.data as { response_rate: number | null } | null)?.response_rate ?? null);
  }, [user?.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }, [load]);

  const topBar = (
    <View style={{ paddingTop: insets.top }}>
      <TopAppBar
        title="Projects"
        right={
          <NewProjectButton
            isPureSeeker={isPureSeeker}
            onPress={() => router.push(isPureSeeker ? '/feed' : '/project-new')}
          />
        }
      />
    </View>
  );

  if (projects === null) {
    return (
      <View style={styles.root}>
        {topBar}
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <ProjectsHeader />
          {[0, 1, 2].map((i) => (
            <HardShadow key={i} radius={Radii.card} offset={4}>
              <View style={styles.skelCard}>
                <Skeleton width="100%" height={76} radius={0} />
                <View style={styles.skelBody}>
                  <Skeleton width={140} height={22} radius={6} />
                  <Skeleton width="78%" height={13} radius={6} />
                  <Skeleton width={120} height={26} radius={6} />
                </View>
              </View>
            </HardShadow>
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    );
  }

  // Distinct read-failure state (mirrors the feed's DeckError language) — a
  // title + body + Retry, never the empty-state CTA over an outage.
  if (loadError) {
    return (
      <View style={styles.root}>
        {topBar}
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Astra.iris} />}
        >
          <ProjectsHeader />
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Couldn't load your projects.</Text>
            <Text style={styles.errorBody}>
              Something went wrong reaching the server. Check your connection and try again.
            </Text>
            <HardShadow radius={Radii.sm} offset={4} style={{ marginTop: 12, alignSelf: 'flex-start' }}>
              <Pressable onPress={load} style={styles.errorBtn} accessibilityRole="button" accessibilityLabel="Retry loading projects">
                <ArrowClockwise size={16} color={Brand.inkOnBrand} weight="bold" />
                <Text style={styles.errorBtnText}>Retry</Text>
              </Pressable>
            </HardShadow>
          </View>
        </ScrollView>
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
      // Up to 4 collaborator faces for the overlapping avatar stack.
      faces: items.slice(0, 4),
    };
  };

  const summary = isPureSeeker
    ? `${exploring.length} ${exploring.length === 1 ? 'project' : 'projects'} in motion`
    : [
        `${activeCount} ${activeCount === 1 ? 'project active' : 'projects active'}`,
        `${interested} interested`,
        unreadTotal > 0 ? `${unreadTotal} unread` : null,
      ].filter(Boolean).join(' · ');

  return (
    <View style={styles.root}>
    {topBar}
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Astra.iris} />}
    >
      <ProjectsHeader summary={summary} />

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
          projects.map((p) => {
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
                  {/* Cover — the founder's uploaded image, else a royal→iris
                      gradient — with a glass status badge top-right. */}
                  <View style={styles.cover}>
                    {p.image_url ? (
                      <Image source={{ uri: p.image_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                    ) : (
                      <LinearGradient
                        colors={[Astra.royal, Astra.iris]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={StyleSheet.absoluteFill}
                      />
                    )}
                    <View style={styles.coverBadge}>
                      <View style={styles.statusBadge}>
                        <Text style={styles.statusText}>{p.active ? 'LIVE' : 'PAUSED'}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.cardBody}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{p.title}</Text>
                    {!!p.vibe_blurb && (
                      <Text style={styles.cardDesc} numberOfLines={2}>{p.vibe_blurb}</Text>
                    )}

                    <View style={styles.metaRow}>
                      {s.faces.length > 0 ? (
                        <View style={styles.faces}>
                          {s.faces.map((f, i) => (
                            <View key={f.conversation_id} style={[styles.face, i > 0 && styles.faceOverlap]}>
                              {f.partner_photo_url ? (
                                <Image source={{ uri: f.partner_photo_url }} style={styles.faceImg} />
                              ) : (
                                <View style={[styles.faceImg, styles.faceFallback]}>
                                  <Text style={styles.faceInitial}>
                                    {(f.partner_name ?? '?').slice(0, 1).toUpperCase()}
                                  </Text>
                                </View>
                              )}
                            </View>
                          ))}
                          {s.total > s.faces.length && (
                            <View style={[styles.face, styles.faceOverlap, styles.faceMore]}>
                              <Text style={styles.faceMoreText}>+{s.total - s.faces.length}</Text>
                            </View>
                          )}
                        </View>
                      ) : (
                        <Text style={styles.metaEmpty}>
                          {p.active ? 'Live and matching' : 'Paused'}
                        </Text>
                      )}

                      <Text style={styles.rateChipText}>
                        {myRate != null
                          ? `${formatResponseRate(myRate)} reply · 72h`
                          : 'New founder'}
                      </Text>
                    </View>
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
                onPress={() => router.push({ pathname: '/thread/[id]', params: { id: item.conversation_id } })}
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

      <View style={{ height: 40 }} />
    </ScrollView>
    </View>
  );
}

/// Just the summary metric ("2 projects active · 10 interested") under the top
/// bar. The section title now lives in the top bar itself ("Projects"), so the
/// old "YOUR STUDIO / Projects" header block is gone.
function ProjectsHeader({ summary }: { summary?: string }) {
  if (!summary) return null;
  return (
    <View style={styles.summaryBlock}>
      <Text style={styles.summary}>{summary}</Text>
      <View style={styles.headerDivider} />
    </View>
  );
}

/// Glass circular icon button docked in the top app bar — starts a new project
/// (owner) or opens discovery to find one (pure seeker).
function NewProjectButton({ isPureSeeker, onPress }: { isPureSeeker: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.newBtn, pressed && { opacity: 0.8 }]}
      accessibilityRole="button"
      accessibilityLabel={isPureSeeker ? 'Find a new project' : 'New project'}
    >
      {isPureSeeker ? (
        <Compass size={20} color={Brand.action} weight="bold" />
      ) : (
        <Plus size={20} color={Brand.action} weight="bold" />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.canvas },
  flex: { flex: 1 },
  content: { paddingHorizontal: Space.lg, paddingTop: Space.md, gap: Space.md },

  // Skeleton (loading) cards — shaped like the real project cards.
  skelCard: {
    backgroundColor: Brand.cardCream,
    borderWidth: 1,
    borderColor: Brand.borderDefault,
    borderRadius: Radii.card,
    overflow: 'hidden',
  },
  skelBody: { padding: 16, gap: 10 },

  // ── Summary line (metric only — title moved to the top bar) ────
  summaryBlock: { paddingTop: Space.xs },
  summary: {
    fontFamily: AmbitFont.body,
    fontSize: 13,
    color: Brand.inkMuted,
  },
  headerDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Astra.hairlinePurple,
    marginTop: 14,
  },

  // ── Top-bar new-project button ─────────────────────────────────
  newBtn: {
    width: 40,
    height: 40,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brand.surface2,
    borderWidth: 1,
    borderColor: Astra.hairlinePurple,
  },

  empty: {
    backgroundColor: Brand.surface1,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Brand.borderDefault,
    padding: Space.lg,
    marginTop: Space.sm,
  },
  emptyTitle: { fontFamily: AmbitFont.semibold, fontSize: 16, color: Brand.inkHigh },
  emptyBody: { fontFamily: AmbitFont.body, fontSize: 13, color: Brand.inkMuted, marginTop: 8, lineHeight: 19 },

  // ── Edit reveal (behind a swiped card) ─────────────────────────
  editReveal: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: Brand.selected,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  editRevealText: {
    fontFamily: AmbitFont.semibold,
    fontSize: 12,
    color: Brand.inkOnBrand,
  },

  // ── Project card ───────────────────────────────────────────────
  card: {
    backgroundColor: Brand.cardCream,
    borderRadius: Radii.card,
    borderWidth: 1,
    borderColor: Brand.borderDefault,
    overflow: 'hidden',
  },
  cover: {
    height: 128,
    overflow: 'hidden',
  },
  coverBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  // Figma project-card badge — dark glass pill, white tracked label.
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: 'rgba(12,0,34,0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  statusText: {
    fontFamily: AmbitFont.semibold,
    fontSize: 10,
    letterSpacing: 0.8,
    color: '#FFFFFF',
  },
  cardBody: { padding: 14, gap: 10 },
  cardTitle: {
    fontFamily: AmbitFont.display,
    fontSize: 20,
    color: Brand.inkPrimary,
  },
  cardDesc: {
    fontFamily: AmbitFont.body,
    fontSize: 13,
    color: Brand.inkBody,
    lineHeight: 19,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    gap: 12,
  },
  // Squared, overlapping collaborator avatars (Figma rounded-7, cream ring).
  faces: { flexDirection: 'row', alignItems: 'center' },
  face: {
    width: 26,
    height: 26,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: Brand.cardCream,
    overflow: 'hidden',
  },
  faceOverlap: { marginLeft: -8 },
  faceImg: { width: '100%', height: '100%' },
  faceFallback: { backgroundColor: Brand.surface2, alignItems: 'center', justifyContent: 'center' },
  faceInitial: { fontFamily: AmbitFont.semibold, fontSize: 11, color: Brand.inkLabel },
  faceMore: { backgroundColor: Brand.surface2, alignItems: 'center', justifyContent: 'center' },
  faceMoreText: { fontFamily: AmbitFont.semibold, fontSize: 10, color: Brand.inkLabel },
  metaEmpty: { fontFamily: AmbitFont.body, fontSize: 13, color: Brand.inkMuted },
  rateChipText: {
    fontFamily: AmbitFont.semibold,
    fontSize: 12,
    color: Astra.iris,
    letterSpacing: 0.2,
  },

  // ── Read-failure state (mirrors the feed's DeckError) ──────────
  errorCard: {
    backgroundColor: Brand.surface1,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Brand.borderDefault,
    padding: Space.lg,
    marginTop: Space.sm,
  },
  errorTitle: { fontFamily: AmbitFont.display, fontSize: 22, color: Brand.inkPrimary },
  errorBody: { fontFamily: AmbitFont.body, fontSize: 14, color: Brand.inkMuted, marginTop: 8, lineHeight: 20 },
  errorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Brand.action,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: Radii.sm,
  },
  errorBtnText: { fontFamily: AmbitFont.semibold, fontSize: 14, color: Brand.inkOnBrand, letterSpacing: 0.4 },

  // ── Seeker engagements ─────────────────────────────────────────
  exploreSection: { gap: 12, marginTop: Space.sm },
  sectionLabel: {
    ...TypeScale.labelSm,
    color: Brand.inkLabel,
  },
  engRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: Brand.cardCream,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Brand.borderDefault,
  },
  engAvatar: { width: 44, height: 44, borderRadius: Radii.md },
  engAvatarFallback: { backgroundColor: Brand.surface2, alignItems: 'center', justifyContent: 'center' },
  engInitial: { fontFamily: AmbitFont.display, fontSize: 18, color: Brand.inkLabel },
  engText: { flex: 1 },
  engTitle: { fontFamily: AmbitFont.semibold, fontSize: 15, color: Brand.inkHigh },
  engSub: { fontFamily: AmbitFont.body, fontSize: 13, color: Brand.inkMuted, marginTop: 2 },
  engUnread: { width: 10, height: 10, borderRadius: 5, backgroundColor: Astra.iris },
});
