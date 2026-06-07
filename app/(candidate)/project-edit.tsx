import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Trash } from 'phosphor-react-native';
import { BackChevron, HardShadow } from '../../components/atoms';
import { DiscoveryCard } from '../../components/molecules';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { ROLE_CATEGORIES, skillsForRoles, type ProjectCardData } from '../../data/mock';
import { AmbitFont, Brand } from '../../constants/theme';

/// Deterministic warm gradient per project id (matches the discovery deck's
/// photo-fallback look).
const CARD_GRADS: [string, string][] = [
  [Brand.primary, Brand.accent],
  ['#C9A57A', '#4D361D'],
  ['#E8C9A0', Brand.primary],
  [Brand.accent, '#7A5A38'],
];
const gradFor = (s: string): [string, string] => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return CARD_GRADS[h % CARD_GRADS.length];
};

const BLURB_MIN = 10;

function SteerChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipOn]}>
      <Text style={[styles.chipText, selected && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

/// Edit project — steered, roles-only (mirrors create). Skills are derived
/// from the roles on save; owners never hand-pick them.
export default function ProjectEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(true); // Edit first; Preview is a tap away
  const [title, setTitle] = useState('');
  const [vibe, setVibe] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [campusId, setCampusId] = useState<string | null>(null);
  const [active, setActive] = useState(true);
  const [owner, setOwner] = useState<{ name: string; photo: string | null }>({ name: '', photo: null });
  const [origText, setOrigText] = useState({ title: '', vibe: '' });
  const [saving, setSaving] = useState(false);

  const allRoles = useMemo(() => ROLE_CATEGORIES.flatMap((c) => c.roles), []);

  useEffect(() => {
    if (!id || !user) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('owner_id, title, vibe_blurb, roles_sought, campus_id, active')
        .eq('id', id)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        Alert.alert('Project not found', 'It may have been deleted.');
        router.back();
        return;
      }
      if ((data as any).owner_id !== user.id) {
        Alert.alert("Can't edit", "You don't own this project.");
        router.back();
        return;
      }
      const d = data as any;
      setTitle(d.title ?? '');
      setVibe(d.vibe_blurb ?? '');
      setRoles(d.roles_sought ?? []);
      setCampusId(d.campus_id ?? null);
      setActive(d.active);
      setOrigText({ title: d.title ?? '', vibe: d.vibe_blurb ?? '' });
      setLoading(false);
      // Owner identity for the Preview card (how seekers see the project).
      const { data: prof } = await supabase
        .from('profiles')
        .select('name, photo_url')
        .eq('id', user.id)
        .maybeSingle();
      if (!cancelled && prof) setOwner({ name: (prof as any).name ?? '', photo: (prof as any).photo_url ?? null });
    })();
    return () => { cancelled = true; };
  }, [id, user?.id]);

  const toggleRole = (r: string) =>
    setRoles((rs) => (rs.includes(r) ? rs.filter((x) => x !== r) : [...rs, r]));

  const valid = title.trim().length > 0 && vibe.trim().length >= BLURB_MIN && roles.length >= 1;

  const save = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('projects')
        .update({
          title: title.trim(),
          vibe_blurb: vibe.trim(),
          required_skills: skillsForRoles(roles),
          roles_sought: roles,
          campus_id: campusId,
          active,
        })
        .eq('id', id);
      if (error) throw error;
      const textChanged = title.trim() !== origText.title || vibe.trim() !== origText.vibe;
      if (textChanged) {
        supabase.functions
          .invoke('embed-vibe', { body: { table: 'projects', id, text: `${title.trim()}\n\n${vibe.trim()}` } })
          .catch((e) => console.warn('embed-vibe failed:', e?.message ?? e));
      }
      router.back();
    } catch (e: any) {
      Alert.alert("Couldn't save", e?.message ?? 'Try again.');
      setSaving(false);
    }
  };

  const del = () => {
    Alert.alert('Delete this project?', 'This permanently removes it. Anyone who saved it will see it disappear.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!id) return;
          const { error } = await supabase.from('projects').delete().eq('id', id);
          if (error) { Alert.alert('Delete failed', error.message); return; }
          router.back();
        },
      },
    ]);
  };

  // Live preview = exactly how a seeker sees this project in the deck.
  const previewCard: ProjectCardData = useMemo(() => ({
    kind: 'project',
    id: id ?? 'preview',
    ownerId: user?.id ?? '',
    title: title.trim() || 'Untitled project',
    pitch: vibe.trim(),
    ownerName: owner.name,
    ownerPhotoUri: owner.photo,
    ownerCampusId: campusId ?? '',
    whyMatched: '',
    skillsSought: skillsForRoles(roles),
    rolesSought: roles,
    gradient: gradFor(id ?? 'preview'),
  }), [id, user?.id, title, vibe, owner, campusId, roles]);

  if (loading) {
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
      <View style={[styles.segHeader, { marginTop: insets.top + 6 }]}>
        <View style={styles.segment}>
          <Pressable onPress={() => setEditing(true)} style={[styles.segmentBtn, editing && styles.segmentBtnActive]} accessibilityLabel="Edit project">
            <Text style={[styles.segmentText, editing && styles.segmentTextActive]}>Edit</Text>
          </Pressable>
          <Pressable onPress={() => setEditing(false)} style={[styles.segmentBtn, !editing && styles.segmentBtnActive]} accessibilityLabel="Preview project">
            <Text style={[styles.segmentText, !editing && styles.segmentTextActive]}>Preview</Text>
          </Pressable>
        </View>
      </View>

      {!editing ? (
        <View style={styles.previewWrap}>
          <DiscoveryCard card={previewCard} showReachButton={false} />
        </View>
      ) : (
        <>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={{ height: 12 }} />
            <Text style={styles.kicker}>EDIT PROJECT</Text>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>PROJECT NAME</Text>
          <TextInput value={title} onChangeText={setTitle} style={styles.input} maxLength={60} placeholderTextColor={Brand.inkPlaceholder} />
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>ONE LINE THAT CAPTURES IT</Text>
          <TextInput value={vibe} onChangeText={setVibe} style={[styles.input, styles.inputMultiline]} multiline maxLength={140} placeholderTextColor={Brand.inkPlaceholder} />
        </View>

        <Text style={styles.secLabel}>ROLES YOU'RE HIRING</Text>
        <View style={styles.chips}>
          {allRoles.map((r) => (
            <SteerChip key={r} label={r} selected={roles.includes(r)} onPress={() => toggleRole(r)} />
          ))}
        </View>

        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleLabel}>{active ? 'Active' : 'Paused'}</Text>
            <Text style={styles.toggleHelp}>
              {active ? "Showing in seekers' discovery feed." : 'Hidden from discovery until you reactivate.'}
            </Text>
          </View>
          <Switch value={active} onValueChange={setActive} trackColor={{ false: Brand.borderDefault, true: Brand.primary }} thumbColor={Brand.canvas} />
        </View>

        <Pressable onPress={del} style={styles.deleteBtn}>
          <Trash size={18} color={Brand.accent} weight="regular" />
          <Text style={styles.deleteLabel}>Delete project</Text>
        </Pressable>

        <View style={{ height: 120 }} />
      </ScrollView>

      <HardShadow radius={999} offset={4} style={[styles.ctaWrap, { bottom: insets.bottom + 24 }, (!valid || saving) && styles.ctaDisabled]}>
        <Pressable onPress={save} disabled={!valid || saving} style={styles.cta}>
          {saving ? <ActivityIndicator color={Brand.actionInk} /> : <Text style={styles.ctaText}>Save changes</Text>}
        </Pressable>
      </HardShadow>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.cardCream },
  center: { alignItems: 'center', justifyContent: 'center' },

  // Edit | Preview segment (mirrors profile)
  segHeader: { alignItems: 'center', paddingBottom: 12 },
  segment: { flexDirection: 'row', backgroundColor: Brand.surface1, borderRadius: 999, padding: 4 },
  segmentBtn: { paddingHorizontal: 24, paddingVertical: 8, borderRadius: 999 },
  segmentBtnActive: { backgroundColor: Brand.action },
  segmentText: { fontFamily: AmbitFont.body, fontSize: 14, fontWeight: '600', color: Brand.inkMuted },
  segmentTextActive: { color: Brand.actionInk, fontWeight: '700' },
  previewWrap: { flex: 1, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },

  scroll: { flex: 1 },
  content: { paddingHorizontal: 28 },
  kicker: { fontFamily: AmbitFont.body, fontSize: 12, fontWeight: '600', letterSpacing: 1.6, color: Brand.accent, marginBottom: 4 },

  field: { marginTop: 32 },
  fieldLabel: { fontFamily: AmbitFont.body, fontSize: 11, fontWeight: '600', letterSpacing: 1, color: Brand.inkLabel, marginBottom: 12 },
  input: { fontFamily: AmbitFont.display, fontSize: 22, color: Brand.inkPrimary, borderBottomWidth: 1.5, borderBottomColor: Brand.borderDefault, paddingBottom: 12 },
  inputMultiline: { fontSize: 18, lineHeight: 25, minHeight: 60, textAlignVertical: 'top' },

  secLabel: { fontFamily: AmbitFont.body, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, color: Brand.inkLabel, marginTop: 36, marginBottom: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  chip: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 999, backgroundColor: Brand.cardCream, borderWidth: 1.5, borderColor: Brand.inkEdge },
  chipOn: { backgroundColor: Brand.action, borderWidth: 1.5, borderColor: Brand.actionInk },
  chipText: { fontFamily: AmbitFont.body, fontSize: 14.5, fontWeight: '600', color: Brand.inkPrimary },
  chipTextOn: { color: Brand.actionInk, fontWeight: '700' },

  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 16, marginTop: 36, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Brand.borderSoft },
  toggleLabel: { fontFamily: AmbitFont.body, fontSize: 15, fontWeight: '600', color: Brand.inkPrimary },
  toggleHelp: { fontFamily: AmbitFont.body, fontSize: 12.5, color: Brand.inkMuted, marginTop: 3, lineHeight: 17 },

  deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 16, marginTop: 8 },
  deleteLabel: { fontFamily: AmbitFont.body, fontSize: 15, fontWeight: '600', color: Brand.accent },

  ctaWrap: { position: 'absolute', alignSelf: 'center' },
  cta: {
    backgroundColor: Brand.action,
    borderWidth: 1.6,
    borderColor: Brand.actionInk,
    paddingHorizontal: 56,
    paddingVertical: 16,
    borderRadius: 999,
    minWidth: 200,
    alignItems: 'center',
  },
  ctaDisabled: { opacity: 0.4 },
  ctaText: { fontFamily: AmbitFont.body, fontSize: 16, fontWeight: '700', color: Brand.actionInk },
});
