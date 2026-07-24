import React, { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, OnboardingProgress, TextField } from '../../components/atoms';
import { ProjectCoverField, ProjectDeadlineField } from '../../components/molecules';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { uploadProjectImage, toDateOnly } from '../../lib/projects';
import { ROLE_CATEGORIES, skillsForRoles } from '../../data/mock';
import { useDirtyGuard } from '../../hooks/useDirtyGuard';
import { checkMinLength } from '../../lib/validation';
import { toast } from '../../lib/toast';
import { AmbitFont, Astra, Brand, Radii } from '../../constants/theme';

/// The pitch is the card: discovery v2 leads with a ~3-sentence elevator
/// pitch, so nudge past one-liners without walling anyone off.
const PITCH_MIN = 40;
const PITCH_MAX = 320;

/// Airy chip — brand-tan when selected (the "Vocabulary steer" — monochrome selection, no tan).
function SteerChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipOn]}>
      <Text style={[styles.chipText, selected && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

/// S-100 Create Project — steered 2-step flow.
///   1. Details: what you're building (name + one-liner).
///   2. Who you're looking for: roles AND the skills they'll need, together
///      (a role implies its skills, so they live on one screen).
export default function ProjectNewScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [step, setStep] = useState(0);
  const [title, setTitle] = useState('');
  const [industry, setIndustry] = useState('');
  const [vibe, setVibe] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [neededBy, setNeededBy] = useState<Date | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const allRoles = useMemo(() => ROLE_CATEGORIES.flatMap((c) => c.roles), []);

  const toggleRole = (r: string) =>
    setRoles((rs) => (rs.includes(r) ? rs.filter((x) => x !== r) : [...rs, r]));

  // Semantic validation → visible "why" copy under the offending field, so the
  // dimmed CTA is never a silent wall (audit theme 3). BLURB_MIN is now
  // communicated live ("N more characters to go").
  const blurbCheck = checkMinLength(vibe, PITCH_MIN);
  const detailsValid = title.trim().length > 0 && industry.trim().length > 0 && blurbCheck.valid;
  const whoValid = roles.length >= 1;
  const canAdvance = step === 0 ? detailsValid : whoValid;

  const submit = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('projects')
        .insert({
          owner_id: user.id,
          title: title.trim(),
          industry: industry.trim(),
          vibe_blurb: vibe.trim(),
          required_skills: skillsForRoles(roles),
          roles_sought: roles,
          needed_by: neededBy ? toDateOnly(neededBy) : null,
        })
        .select('id')
        .single();
      if (error) throw error;
      supabase.functions
        .invoke('embed-vibe', { body: { table: 'projects', id: data.id, text: `${title.trim()}\n\n${vibe.trim()}` } })
        .catch((e) => console.warn('embed-vibe failed:', e?.message ?? e));
      // Cover is best-effort: the project already exists, so a failed upload
      // shouldn't block creation — but it must NOT fail silently. Toast the
      // partial success with a Retry that re-attempts just the cover.
      if (coverUri) {
        const projectId = data.id;
        const uploadCover = async () => {
          const url = await uploadProjectImage(user.id, projectId, coverUri, Date.now());
          await supabase.from('projects').update({ image_url: url }).eq('id', projectId);
        };
        try {
          await uploadCover();
        } catch (e: any) {
          console.warn('project cover upload failed:', e?.message ?? e);
          toast.error("Project created, but the cover didn't upload", {
            actionLabel: 'Retry',
            onAction: () => {
              uploadCover().catch(() => toast.error("The cover still didn't upload."));
            },
          });
        }
      }
      // Created — leave without the dirty-guard prompt (nothing to discard).
      commit(() => router.back());
    } catch (e: any) {
      Alert.alert("Couldn't create project", e?.message ?? 'Try again.');
      setSubmitting(false);
    }
  };

  const advance = () => (step === 0 ? setStep(1) : submit());

  // Dirty when any field has diverged from its empty initial state — so a back
  // tap that would discard typed edits prompts a confirm first.
  const isDirty =
    title.trim().length > 0 ||
    industry.trim().length > 0 ||
    vibe.trim().length > 0 ||
    roles.length > 0 ||
    coverUri !== null ||
    neededBy !== null;
  const { guardBack, commit } = useDirtyGuard(isDirty);

  // Step 0 back leaves the screen (guarded); step 1 back just returns to step 0
  // without losing anything, so it needs no guard.
  const onBack = () => (step === 0 ? guardBack(() => router.back()) : setStep(0));

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 6 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header scrolls WITH the content (not sticky): inline back chevron
            on the left, circular ring progress on the right. */}
        <View style={styles.headerRow}>
          <Pressable
            onPress={onBack}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={styles.backBtn}
          >
            <Text style={styles.backGlyph}>‹</Text>
          </Pressable>
          <OnboardingProgress current={step + 1} total={2} />
        </View>

        <Text style={styles.kicker}>NEW PROJECT · {step + 1} OF 2</Text>

        {step === 0 ? (
          <>
            <Text style={styles.h}>What are you{'\n'}building?</Text>
            <View style={styles.field}>
              <TextField
                label="Project name"
                value={title}
                onChangeText={setTitle}
                placeholder="Ambit"
                maxLength={60}
                returnKeyType="next"
              />
            </View>
            <View style={styles.field}>
              <TextField
                label="Industry / topic"
                value={industry}
                onChangeText={setIndustry}
                placeholder="Campus networking, fintech, health…"
                maxLength={40}
                returnKeyType="next"
              />
            </View>
            <View style={styles.field}>
              <TextField
                label="Your elevator pitch"
                value={vibe}
                onChangeText={setVibe}
                placeholder="Three sentences: what you're building, who it's for, and why it matters right now."
                textarea
                maxLength={PITCH_MAX}
                helper={blurbCheck.reason ?? 'This is the first thing seekers read on your card — aim for about three sentences.'}
              />
            </View>
            <ProjectCoverField uri={coverUri} onChange={setCoverUri} />
            <ProjectDeadlineField value={neededBy} onChange={setNeededBy} />
          </>
        ) : (
          <>
            <Text style={styles.h}>Who do you{'\n'}need?</Text>
            <Text style={styles.sub}>Pick the roles you're hiring for. We match people by the skills each role needs.</Text>

            <Text style={styles.secLabel}>ROLES YOU'RE HIRING</Text>
            <View style={styles.chips}>
              {allRoles.map((r) => (
                <SteerChip key={r} label={r} selected={roles.includes(r)} onPress={() => toggleRole(r)} />
              ))}
            </View>
            {roles.length === 0 ? <Text style={styles.helper}>Pick at least one role to continue.</Text> : null}
          </>
        )}
        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={[styles.ctaWrap, { bottom: insets.bottom + 24 }]}>
        <Button
          title={submitting ? 'Creating…' : step === 0 ? 'Continue' : 'Create project'}
          onPress={advance}
          disabled={!canAdvance || submitting}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.canvas },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  backBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    marginLeft: -8,
    paddingLeft: 8,
  },
  backGlyph: {
    fontFamily: AmbitFont.body,
    fontSize: 28,
    color: Brand.inkMuted,
    lineHeight: 32,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 28 },
  kicker: {
    fontFamily: AmbitFont.body,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.6,
    color: Brand.inkMuted,
    marginBottom: 16,
  },
  h: { fontFamily: AmbitFont.display, fontSize: 34, lineHeight: 40, color: Brand.inkPrimary },
  sub: { fontFamily: AmbitFont.body, fontSize: 14.5, color: Brand.inkMuted, marginTop: 16, lineHeight: 21 },

  field: { marginTop: 32 },

  secLabel: { fontFamily: AmbitFont.semibold, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: Brand.inkLabel, marginTop: 36, marginBottom: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  chip: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: Radii.sm, backgroundColor: Brand.cardCream, borderWidth: 1, borderColor: Astra.hairlinePurple },
  chipOn: { backgroundColor: Brand.action, borderColor: Brand.action },
  chipText: { fontFamily: AmbitFont.medium, fontSize: 14.5, color: Brand.inkPrimary },
  chipTextOn: { color: Brand.inkOnBrand, fontFamily: AmbitFont.semibold },
  helper: { fontFamily: AmbitFont.body, fontSize: 13, color: Brand.inkMuted, marginTop: 10, lineHeight: 18 },

  ctaWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
});
