import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackChevron } from '../../components/atoms';
import { ProjectForm, ProjectFormValues } from '../../components/organisms/ProjectForm';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { AmbitFont, Brand, Space } from '../../constants/theme';

/// S-100 Create Project. Reached via the "+ New project" CTA on the
/// projects tab. Inserts into Supabase under RLS (owner_id = auth.uid())
/// and fires the embed-vibe Edge Function so the project becomes
/// matchable on vibe similarity, not just skill overlap.
export default function ProjectNewScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [defaultCampusId, setDefaultCampusId] = useState<string | null>(null);

  // Default campus to the user's profile campus so they don't re-pick what
  // they already told us during onboarding. We only need this for the
  // initial render — once the form mounts, its internal state owns it.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('campus_id')
        .eq('id', user.id)
        .maybeSingle();
      if (!cancelled && data?.campus_id) setDefaultCampusId(data.campus_id);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const handleSubmit = async (values: ProjectFormValues) => {
    if (!user) throw new Error('Not signed in.');
    const { data, error } = await supabase
      .from('projects')
      .insert({
        owner_id: user.id,
        title: values.title,
        vibe_blurb: values.vibeBlurb,
        required_skills: values.requiredSkills,
        roles_sought: values.rolesSought,
        campus_id: values.campusId,
      })
      .select('id')
      .single();
    if (error) throw error;

    // Fire-and-forget. Without an embedding the project still matches on
    // skill overlap; we just lose vibe-similarity in compat_projects_for_seeker.
    // Don't block UX on it — OPENAI_API_KEY may not be set in dev.
    supabase.functions
      .invoke('embed-vibe', {
        body: {
          table: 'projects',
          id: data.id,
          text: `${values.title}\n\n${values.vibeBlurb}`,
        },
      })
      .catch((e) => console.warn('embed-vibe failed:', e?.message ?? e));

    router.back();
  };

  return (
    <View style={styles.root}>
      <BackChevron onPress={() => router.back()} />
      <View style={[styles.header, { marginTop: insets.top + 40 }]}>
        <Text style={styles.title}>New project</Text>
        <Text style={styles.subtitle}>
          Pitch what you're building. Pick the skills your team needs. The right people surface in your feed.
        </Text>
      </View>
      <ProjectForm
        initialValues={{ campusId: defaultCampusId }}
        submitLabel="Create project"
        onSubmit={handleSubmit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.canvas },
  header: { paddingHorizontal: Space.lg, paddingBottom: Space.md },
  title: {
    fontFamily: AmbitFont.display,
    fontSize: 30,
    color: Brand.inkPrimary,
  },
  subtitle: {
    fontFamily: AmbitFont.body,
    fontSize: 14,
    color: Brand.inkMuted,
    marginTop: 8,
    lineHeight: 20,
  },
});
