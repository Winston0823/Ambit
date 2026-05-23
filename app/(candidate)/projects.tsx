import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Compass, Plus } from 'phosphor-react-native';
import { useAuth } from '../../context/AuthContext';
import { useProfileRole } from '../../hooks/useProfileRole';
import { supabase } from '../../lib/supabase';
import { AmbitFont, Brand, Radii, Space } from '../../constants/theme';

interface ProjectRow {
  id: string;
  title: string;
  vibe_blurb: string;
  required_skills: string[];
  active: boolean;
  created_at: string;
}

/// S-024 Your Projects. Lists projects owned by the signed-in user
/// (including paused ones — that requires the 002_project_owner_read
/// RLS policy). Re-loads on focus so a fresh insert/edit/delete from
/// the form screens shows up without a manual pull-to-refresh.
export default function ProjectsTab() {
  const { user } = useAuth();
  const { role } = useProfileRole();
  /// Pure seekers don't create projects — they join them. The CTA on this
  /// tab redirects them to the discovery feed instead of the project-new
  /// form. Owners and 'both' users still see the "New project" creation
  /// flow. 'both' defaults to owner-mode here since they can already get
  /// to discovery via the nav bar.
  const isPureSeeker = role === 'seeker';
  const [projects, setProjects] = useState<ProjectRow[] | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setProjects([]);
      return;
    }
    const { data } = await supabase
      .from('projects')
      .select('id, title, vibe_blurb, required_skills, active, created_at')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false });
    setProjects((data ?? []) as ProjectRow[]);
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (projects === null) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={Brand.accent} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>YOURS</Text>
      <Text style={styles.title}>Your projects</Text>

      <Pressable
        onPress={() => router.push(isPureSeeker ? '/feed' : '/project-new')}
        style={styles.newBtn}
        accessibilityRole="button"
      >
        {isPureSeeker ? (
          <Compass size={18} color={Brand.inkOnBrand} weight="bold" />
        ) : (
          <Plus size={18} color={Brand.inkOnBrand} weight="bold" />
        )}
        <Text style={styles.newBtnLabel}>
          {isPureSeeker ? 'Find new project' : 'New project'}
        </Text>
      </Pressable>

      {projects.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Nothing here yet</Text>
          <Text style={styles.emptyBody}>
            Start a project to share what you're building. Seekers with the right skills surface in your discovery feed.
          </Text>
        </View>
      ) : (
        projects.map((p) => (
          <Pressable
            key={p.id}
            onPress={() =>
              router.push({ pathname: '/project-edit', params: { id: p.id } })
            }
            style={styles.card}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {p.title}
              </Text>
              <View style={[styles.statusPill, !p.active && styles.statusPillPaused]}>
                <Text
                  style={[styles.statusText, !p.active && styles.statusTextPaused]}
                >
                  {p.active ? 'Active' : 'Paused'}
                </Text>
              </View>
            </View>
            <Text style={styles.cardBody} numberOfLines={2}>
              {p.vibe_blurb}
            </Text>
            {p.required_skills.length > 0 && (
              <View style={styles.chipRow}>
                {p.required_skills.slice(0, 5).map((s) => (
                  <View key={s} style={styles.chip}>
                    <Text style={styles.chipText}>{s}</Text>
                  </View>
                ))}
                {p.required_skills.length > 5 && (
                  <Text style={styles.moreText}>
                    +{p.required_skills.length - 5}
                  </Text>
                )}
              </View>
            )}
          </Pressable>
        ))
      )}

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.canvas },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: {
    paddingHorizontal: Space.lg,
    paddingTop: Space.lg,
    gap: Space.md,
  },
  eyebrow: {
    fontFamily: AmbitFont.body,
    fontSize: 11,
    letterSpacing: 1.2,
    color: Brand.inkLabel,
  },
  title: {
    fontFamily: AmbitFont.display,
    fontSize: 30,
    color: Brand.inkPrimary,
    marginTop: -16,
  },

  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: Brand.primary,
    borderRadius: Radii.md,
  },
  newBtnLabel: {
    fontFamily: AmbitFont.body,
    fontSize: 15,
    fontWeight: '600',
    color: Brand.inkOnBrand,
  },

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

  card: {
    backgroundColor: Brand.surface1,
    borderRadius: Radii.lg,
    padding: Space.md,
    gap: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardTitle: {
    flex: 1,
    fontFamily: AmbitFont.body,
    fontSize: 16,
    fontWeight: '600',
    color: Brand.inkHigh,
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
  cardBody: {
    fontFamily: AmbitFont.body,
    fontSize: 13,
    color: Brand.inkBody,
    lineHeight: 18,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: Brand.canvas,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Brand.borderDefault,
  },
  chipText: {
    fontFamily: AmbitFont.body,
    fontSize: 11,
    color: Brand.inkBody,
  },
  moreText: {
    fontFamily: AmbitFont.body,
    fontSize: 11,
    color: Brand.inkMuted,
    paddingHorizontal: 4,
  },
});
