import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, X } from 'phosphor-react-native';
import { BackChevron, OnboardingProgress } from '../../components/atoms';
import { BottomSheet } from '../../components/molecules';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { ROLE_CATEGORIES, ROLE_SKILLS, SKILL_CATEGORIES } from '../../data/mock';
import { AmbitFont, Brand, Space } from '../../constants/theme';

const BLURB_MIN = 10;
const SKILLS_MAX = 8;

/// Airy ink-fill chip (the "Vocabulary steer" — monochrome selection, no tan).
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
  const [vibe, setVibe] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  // Skills are DERIVED from roles (a role implies its skills). The owner can
  // tweak: manualSkills adds beyond the roles, removedSkills drops auto ones.
  const [manualSkills, setManualSkills] = useState<string[]>([]);
  const [removedSkills, setRemovedSkills] = useState<string[]>([]);
  const [skillSheet, setSkillSheet] = useState(false);
  const [campusId, setCampusId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from('profiles').select('campus_id').eq('id', user.id).maybeSingle();
      if (!cancelled && data?.campus_id) setCampusId(data.campus_id);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  const allRoles = useMemo(() => ROLE_CATEGORIES.flatMap((c) => c.roles), []);

  // Effective skill set = roles' implied skills + manual adds − manual removes.
  const skills = useMemo(() => {
    const fromRoles = new Set(roles.flatMap((r) => ROLE_SKILLS[r] ?? []));
    manualSkills.forEach((s) => fromRoles.add(s));
    removedSkills.forEach((s) => fromRoles.delete(s));
    return [...fromRoles];
  }, [roles, manualSkills, removedSkills]);

  const toggleRole = (r: string) =>
    setRoles((rs) => (rs.includes(r) ? rs.filter((x) => x !== r) : [...rs, r]));

  const removeSkill = (s: string) => {
    setManualSkills((m) => m.filter((x) => x !== s));
    setRemovedSkills((r) => (r.includes(s) ? r : [...r, s]));
  };
  const addSkill = (s: string) => {
    setRemovedSkills((r) => r.filter((x) => x !== s));
    setManualSkills((m) => (m.includes(s) ? m : [...m, s]));
  };
  const toggleSkill = (s: string) => (skills.includes(s) ? removeSkill(s) : addSkill(s));

  const detailsValid = title.trim().length > 0 && vibe.trim().length >= BLURB_MIN;
  const whoValid = skills.length >= 1;
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
          vibe_blurb: vibe.trim(),
          required_skills: skills,
          roles_sought: roles,
          campus_id: campusId,
        })
        .select('id')
        .single();
      if (error) throw error;
      supabase.functions
        .invoke('embed-vibe', { body: { table: 'projects', id: data.id, text: `${title.trim()}\n\n${vibe.trim()}` } })
        .catch((e) => console.warn('embed-vibe failed:', e?.message ?? e));
      router.back();
    } catch (e: any) {
      Alert.alert("Couldn't create project", e?.message ?? 'Try again.');
      setSubmitting(false);
    }
  };

  const advance = () => (step === 0 ? setStep(1) : submit());

  return (
    <View style={styles.root}>
      <View style={{ marginTop: insets.top + 14 }}>
        <OnboardingProgress current={step + 1} total={2} />
      </View>
      <BackChevron onPress={() => (step === 0 ? router.back() : setStep(0))} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.kicker}>NEW PROJECT · {step + 1} OF 2</Text>

        {step === 0 ? (
          <>
            <Text style={styles.h}>What are you{'\n'}building?</Text>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>PROJECT NAME</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Ambit"
                placeholderTextColor={Brand.inkPlaceholder}
                style={styles.input}
                maxLength={60}
                returnKeyType="next"
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>ONE LINE THAT CAPTURES IT</Text>
              <TextInput
                value={vibe}
                onChangeText={setVibe}
                placeholder="A warmer way to find your team on campus…"
                placeholderTextColor={Brand.inkPlaceholder}
                style={[styles.input, styles.inputMultiline]}
                multiline
                maxLength={140}
              />
            </View>
          </>
        ) : (
          <>
            <Text style={styles.h}>Who do you{'\n'}need?</Text>
            <Text style={styles.sub}>Pick the roles you're hiring for — we'll fill in the skills to match on.</Text>

            <Text style={styles.secLabel}>ROLES YOU'RE HIRING</Text>
            <View style={styles.chips}>
              {allRoles.map((r) => (
                <SteerChip key={r} label={r} selected={roles.includes(r)} onPress={() => toggleRole(r)} />
              ))}
            </View>

            {(roles.length > 0 || skills.length > 0) && (
              <>
                <Text style={[styles.secLabel, { marginTop: 34 }]}>SKILLS WE'LL MATCH ON</Text>
                <Text style={styles.skillHint}>Auto-filled from your roles — tap × to remove, or add your own.</Text>
                <View style={styles.chips}>
                  {skills.map((s) => (
                    <Pressable key={s} onPress={() => removeSkill(s)} style={[styles.chip, styles.chipOn, styles.skillChip]}>
                      <Text style={[styles.chipText, styles.chipTextOn]}>{s}</Text>
                      <X size={13} color={Brand.cardCream} weight="bold" />
                    </Pressable>
                  ))}
                  <Pressable onPress={() => setSkillSheet(true)} style={[styles.chip, styles.addChip]}>
                    <Plus size={14} color={Brand.accent} weight="bold" />
                    <Text style={styles.addChipText}>Add</Text>
                  </Pressable>
                </View>
              </>
            )}
          </>
        )}
        <View style={{ height: 120 }} />
      </ScrollView>

      <Pressable
        onPress={advance}
        disabled={!canAdvance || submitting}
        style={[styles.cta, { bottom: insets.bottom + 24 }, (!canAdvance || submitting) && styles.ctaDisabled]}
      >
        {submitting ? (
          <ActivityIndicator color={Brand.cardCream} />
        ) : (
          <Text style={styles.ctaText}>{step === 0 ? 'Continue' : 'Create project'}</Text>
        )}
      </Pressable>

      <BottomSheet visible={skillSheet} onClose={() => setSkillSheet(false)} snapPoints={[0.5, 0.92]}>
        <Text style={styles.sheetTitle}>Skills to match on</Text>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {SKILL_CATEGORIES.map((cat) => (
            <View key={cat.label} style={styles.skillCat}>
              <Text style={styles.skillCatLabel}>{cat.label}</Text>
              <View style={styles.chips}>
                {cat.tags.map((t) => (
                  <SteerChip key={t} label={t} selected={skills.includes(t)} onPress={() => toggleSkill(t)} />
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      </BottomSheet>
    </View>
  );
}

const INK = '#2A2018';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.cardCream },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 28, paddingTop: 28 },
  kicker: {
    fontFamily: AmbitFont.body,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.6,
    color: Brand.accent,
    marginBottom: 14,
  },
  h: { fontFamily: AmbitFont.display, fontSize: 35, lineHeight: 41, color: Brand.inkPrimary },
  sub: { fontFamily: AmbitFont.body, fontSize: 14.5, color: Brand.inkMuted, marginTop: 14, lineHeight: 21 },

  field: { marginTop: 36 },
  fieldLabel: { fontFamily: AmbitFont.body, fontSize: 11, fontWeight: '600', letterSpacing: 1, color: Brand.inkLabel, marginBottom: 10 },
  input: {
    fontFamily: AmbitFont.display,
    fontSize: 22,
    color: Brand.inkPrimary,
    borderBottomWidth: 1.5,
    borderBottomColor: Brand.borderDefault,
    paddingBottom: 10,
  },
  inputMultiline: { fontSize: 18, lineHeight: 25, minHeight: 60, textAlignVertical: 'top' },

  secLabel: { fontFamily: AmbitFont.body, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, color: Brand.inkLabel, marginTop: 36, marginBottom: 14 },
  skillCat: { marginTop: 18 },
  skillCatLabel: { fontFamily: AmbitFont.body, fontSize: 10.5, letterSpacing: 1, color: Brand.inkMuted, marginBottom: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { paddingHorizontal: 16, paddingVertical: 11, borderRadius: 999, backgroundColor: '#EBE3D5' },
  chipOn: { backgroundColor: INK },
  chipText: { fontFamily: AmbitFont.body, fontSize: 14.5, fontWeight: '500', color: '#5A4A36' },
  chipTextOn: { color: Brand.cardCream },
  skillChip: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  addChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'transparent', borderWidth: 1.5, borderColor: Brand.accent },
  addChipText: { fontFamily: AmbitFont.body, fontSize: 14.5, fontWeight: '600', color: Brand.accent },
  skillHint: { fontFamily: AmbitFont.body, fontSize: 13, color: Brand.inkMuted, marginTop: -6, marginBottom: 14, lineHeight: 19 },
  sheetTitle: { fontFamily: AmbitFont.display, fontSize: 22, color: Brand.inkPrimary, marginBottom: 16 },

  cta: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: INK,
    paddingHorizontal: 54,
    paddingVertical: 17,
    borderRadius: 999,
    minWidth: 200,
    alignItems: 'center',
    shadowColor: '#241C14',
    shadowOpacity: 0.22,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  ctaDisabled: { opacity: 0.4 },
  ctaText: { fontFamily: AmbitFont.body, fontSize: 16, fontWeight: '600', color: Brand.cardCream },
});
