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
import { BackChevron, OnboardingProgress } from '../../components/atoms';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { ROLE_CATEGORIES, skillsForRoles } from '../../data/mock';
import { AmbitFont, Brand, Space } from '../../constants/theme';

const BLURB_MIN = 10;

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
  const [vibe, setVibe] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
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

  const toggleRole = (r: string) =>
    setRoles((rs) => (rs.includes(r) ? rs.filter((x) => x !== r) : [...rs, r]));

  const detailsValid = title.trim().length > 0 && vibe.trim().length >= BLURB_MIN;
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
          vibe_blurb: vibe.trim(),
          required_skills: skillsForRoles(roles),
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
            <Text style={styles.sub}>Pick the roles you're hiring for. We match people by the skills each role needs.</Text>

            <Text style={styles.secLabel}>ROLES YOU'RE HIRING</Text>
            <View style={styles.chips}>
              {allRoles.map((r) => (
                <SteerChip key={r} label={r} selected={roles.includes(r)} onPress={() => toggleRole(r)} />
              ))}
            </View>
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
          <ActivityIndicator color={Brand.actionInk} />
        ) : (
          <Text style={styles.ctaText}>{step === 0 ? 'Continue' : 'Create project'}</Text>
        )}
      </Pressable>
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
  chipOn: { backgroundColor: Brand.action, borderWidth: 1.5, borderColor: Brand.actionInk, shadowColor: Brand.actionInk, shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 0, height: 2 } },
  chipText: { fontFamily: AmbitFont.body, fontSize: 14.5, fontWeight: '500', color: '#5A4A36' },
  chipTextOn: { color: Brand.actionInk, fontWeight: '700' },
  skillChip: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  addChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'transparent', borderWidth: 1.5, borderColor: Brand.accent },
  addChipText: { fontFamily: AmbitFont.body, fontSize: 14.5, fontWeight: '600', color: Brand.accent },
  skillHint: { fontFamily: AmbitFont.body, fontSize: 13, color: Brand.inkMuted, marginTop: -6, marginBottom: 14, lineHeight: 19 },
  sheetTitle: { fontFamily: AmbitFont.display, fontSize: 22, color: Brand.inkPrimary, marginBottom: 16 },

  cta: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: Brand.action,
    borderWidth: 1.6,
    borderColor: Brand.actionInk,
    paddingHorizontal: 54,
    paddingVertical: 16,
    borderRadius: 999,
    minWidth: 200,
    alignItems: 'center',
    shadowColor: Brand.actionInk,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 4 },
    elevation: 0,
  },
  ctaDisabled: { opacity: 0.4 },
  ctaText: { fontFamily: AmbitFont.body, fontSize: 16, fontWeight: '700', color: Brand.actionInk },
});
