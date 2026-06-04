import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Trash } from 'phosphor-react-native';
import { BackChevron } from '../../components/atoms';
import { ProjectForm, ProjectFormValues } from '../../components/organisms/ProjectForm';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { AmbitFont, Brand, Radii, Space } from '../../constants/theme';

interface ProjectRow {
  id: string;
  owner_id: string;
  title: string;
  vibe_blurb: string;
  required_skills: string[];
  campus_id: string | null;
  active: boolean;
}

/// S-101 Edit Project. Loads a project by id (must be owned by the
/// signed-in user — RLS enforces this at the DB layer; we also check
/// client-side so we can show a clearer error). Save updates the row;
/// the Switch toggles `active` (soft pause); the destructive button
/// hard-deletes after confirmation.
export default function ProjectEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [project, setProject] = useState<ProjectRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (!id || !user) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, owner_id, title, vibe_blurb, required_skills, campus_id, active')
        .eq('id', id)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        Alert.alert('Project not found', 'It may have been deleted.');
        router.back();
        return;
      }
      if (data.owner_id !== user.id) {
        Alert.alert("Can't edit", "You don't own this project.");
        router.back();
        return;
      }
      setProject(data);
      setActive(data.active);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id, user?.id]);

  const handleSubmit = async (values: ProjectFormValues) => {
    if (!project) return;
    // Re-embed only when the embeddable text actually changed. Skill or
    // campus edits don't affect the vibe vector.
    const textChanged =
      values.title !== project.title || values.vibeBlurb !== project.vibe_blurb;

    const { error } = await supabase
      .from('projects')
      .update({
        title: values.title,
        vibe_blurb: values.vibeBlurb,
        required_skills: values.requiredSkills,
        campus_id: values.campusId,
        active,
      })
      .eq('id', project.id);
    if (error) throw error;

    if (textChanged) {
      supabase.functions
        .invoke('embed-vibe', {
          body: {
            table: 'projects',
            id: project.id,
            text: `${values.title}\n\n${values.vibeBlurb}`,
          },
        })
        .catch((e) => console.warn('embed-vibe failed:', e?.message ?? e));
    }

    router.back();
  };

  const handleDelete = () => {
    if (!project) return;
    Alert.alert(
      'Delete this project?',
      'This permanently removes it. Anyone who saved it will see it disappear.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('projects')
              .delete()
              .eq('id', project.id);
            if (error) {
              Alert.alert('Delete failed', error.message);
              return;
            }
            router.back();
          },
        },
      ],
    );
  };

  if (loading || !project) {
    return (
      <View style={[styles.root, styles.center]}>
        <BackChevron onPress={() => router.back()} />
        <ActivityIndicator color={Brand.accent} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <BackChevron onPress={() => router.back()} />
      <View style={[styles.header, { marginTop: insets.top + 40 }]}>
        <Text style={styles.title}>Edit project</Text>
        <Text style={styles.subtitle}>
          Update the pitch, swap skills, or pause matching when you're not actively recruiting.
        </Text>
      </View>
      <ProjectForm
        initialValues={{
          title: project.title,
          vibeBlurb: project.vibe_blurb,
          requiredSkills: project.required_skills,
          rolesSought: [],
          campusId: project.campus_id,
        }}
        submitLabel="Save changes"
        onSubmit={handleSubmit}
        extraActions={
          <View style={{ gap: Space.md, marginTop: Space.sm }}>
            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleLabel}>
                  {active ? 'Active' : 'Paused'}
                </Text>
                <Text style={styles.toggleHelp}>
                  {active
                    ? "Showing in seekers' discovery feed."
                    : 'Hidden from discovery until you reactivate.'}
                </Text>
              </View>
              <Switch
                value={active}
                onValueChange={setActive}
                trackColor={{ false: Brand.borderDefault, true: Brand.primary }}
                thumbColor={Brand.canvas}
              />
            </View>
            <Pressable onPress={handleDelete} style={styles.deleteBtn}>
              <Trash size={18} color={Brand.accent} weight="regular" />
              <Text style={styles.deleteLabel}>Delete project</Text>
            </Pressable>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.canvas },
  center: { alignItems: 'center', justifyContent: 'center' },
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
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: Brand.surface1,
    borderRadius: Radii.md,
  },
  toggleLabel: {
    fontFamily: AmbitFont.body,
    fontSize: 15,
    fontWeight: '600',
    color: Brand.inkPrimary,
  },
  toggleHelp: {
    fontFamily: AmbitFont.body,
    fontSize: 12,
    color: Brand.inkMuted,
    marginTop: 2,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: Radii.md,
    borderWidth: 1.5,
    borderColor: Brand.borderDefault,
    backgroundColor: 'transparent',
  },
  deleteLabel: {
    fontFamily: AmbitFont.body,
    fontSize: 15,
    fontWeight: '600',
    color: Brand.accent,
  },
});
