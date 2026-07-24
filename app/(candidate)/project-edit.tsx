import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Trash } from 'phosphor-react-native';
import { BackChevron, Button, TextField } from '../../components/atoms';
import { DiscoveryCard, ProjectCoverField, ProjectDeadlineField } from '../../components/molecules';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { uploadProjectImage, toDateOnly } from '../../lib/projects';
import { ROLE_CATEGORIES, skillsForRoles, type ProjectCardData } from '../../data/mock';
import { useDirtyGuard } from '../../hooks/useDirtyGuard';
import { checkMinLength } from '../../lib/validation';
import { AmbitFont, Astra, Brand, Radii } from '../../constants/theme';

/// Deterministic royal→iris gradient per project id (matches the discovery
/// deck's photo-fallback look).
const CARD_GRADS: [string, string][] = [
  [Astra.royal, Astra.iris],
  [Astra.void, Astra.royal],
  [Brand.selected, Astra.iris],
  [Astra.royal, Brand.selected],
];
const gradFor = (s: string): [string, string] => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return CARD_GRADS[h % CARD_GRADS.length];
};

const BLURB_MIN = 10;

/// Parse a `YYYY-MM-DD` date-only string into a local Date (avoids the UTC
/// day-shift of `new Date('2026-04-30')`). Null/empty → null.
function parseDateOnly(s: string | null | undefined): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState(true); // Edit first; Preview is a tap away
  const [title, setTitle] = useState('');
  const [vibe, setVibe] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [active, setActive] = useState(true);
  const [owner, setOwner] = useState<{ name: string; avatarId: string; openToNearby: boolean | null }>({ name: '', avatarId: 'monster-01', openToNearby: null });
  const [coverUrl, setCoverUrl] = useState<string | null>(null); // saved cover (remote)
  const [pickedUri, setPickedUri] = useState<string | null>(null); // new local pick, uploaded on save
  const [neededBy, setNeededBy] = useState<Date | null>(null);
  // Full snapshot of the loaded project — used both for the embed-vibe
  // re-embed check and for the back dirty-guard. `neededBy` is compared via
  // its date-only string form so a re-parsed Date object doesn't read dirty.
  const [orig, setOrig] = useState<{
    title: string;
    vibe: string;
    roles: string[];
    coverUrl: string | null;
    neededBy: string | null;
    active: boolean;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  const allRoles = useMemo(() => ROLE_CATEGORIES.flatMap((c) => c.roles), []);

  useEffect(() => {
    // No id (bad deep-link / param drop): don't sit on an endless spinner —
    // surface an error state with a back affordance.
    if (!id) {
      setLoading(false);
      setLoadError('This project link is invalid.');
      return;
    }
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('owner_id, title, vibe_blurb, roles_sought, image_url, needed_by, active')
        .eq('id', id)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setLoading(false);
        setLoadError('Project not found. It may have been deleted.');
        return;
      }
      if ((data as any).owner_id !== user.id) {
        setLoading(false);
        setLoadError("You don't own this project, so it can't be edited.");
        return;
      }
      const d = data as any;
      const loadedRoles: string[] = d.roles_sought ?? [];
      const loadedNeededBy: string | null = d.needed_by ?? null;
      const loadedActive: boolean = d.active;
      const loadedCover: string | null = d.image_url ?? null;
      setTitle(d.title ?? '');
      setVibe(d.vibe_blurb ?? '');
      setRoles(loadedRoles);
      setCoverUrl(loadedCover);
      setNeededBy(parseDateOnly(loadedNeededBy));
      setActive(loadedActive);
      setOrig({
        title: d.title ?? '',
        vibe: d.vibe_blurb ?? '',
        roles: loadedRoles,
        coverUrl: loadedCover,
        neededBy: loadedNeededBy,
        active: loadedActive,
      });
      setLoading(false);
      // Owner identity for the Preview card (how seekers see the project).
      const { data: prof } = await supabase
        .from('profiles')
        .select('name, avatar_id, open_to_nearby')
        .eq('id', user.id)
        .maybeSingle();
      if (!cancelled && prof) setOwner({
        name: (prof as any).name ?? '',
        avatarId: (prof as any).avatar_id ?? 'monster-01',
        openToNearby: (prof as any).open_to_nearby ?? null,
      });
    })();
    return () => { cancelled = true; };
  }, [id, user?.id]);

  const toggleRole = (r: string) =>
    setRoles((rs) => (rs.includes(r) ? rs.filter((x) => x !== r) : [...rs, r]));

  // Semantic validation → visible "why" copy under each offending field, so
  // the dimmed Save button is never a silent wall (audit theme 3).
  const blurbCheck = checkMinLength(vibe, BLURB_MIN);
  const valid = title.trim().length > 0 && blurbCheck.valid && roles.length >= 1;

  // Dirty when any editable field differs from the loaded project. The pause
  // toggle (`active`) is part of the form, so flipping it counts as unsaved.
  // A freshly-picked cover (pickedUri) is always a change.
  const sameRoles = (a: string[], b: string[]) =>
    a.length === b.length && a.every((r) => b.includes(r));
  const isDirty =
    !!orig &&
    (title.trim() !== orig.title.trim() ||
      vibe.trim() !== orig.vibe.trim() ||
      !sameRoles(roles, orig.roles) ||
      (neededBy ? toDateOnly(neededBy) : null) !== orig.neededBy ||
      active !== orig.active ||
      pickedUri !== null);
  const { guardBack, commit } = useDirtyGuard(isDirty);

  const save = async () => {
    if (!id || !user) return;
    setSaving(true);
    try {
      // Upload a freshly-picked cover first so its public URL goes in the same
      // update. If nothing new was picked, leave image_url untouched.
      const nextImageUrl = pickedUri
        ? await uploadProjectImage(user.id, id, pickedUri, Date.now())
        : undefined;
      const { error } = await supabase
        .from('projects')
        .update({
          title: title.trim(),
          vibe_blurb: vibe.trim(),
          required_skills: skillsForRoles(roles),
          roles_sought: roles,
          active,
          needed_by: neededBy ? toDateOnly(neededBy) : null,
          ...(nextImageUrl ? { image_url: nextImageUrl } : {}),
        })
        .eq('id', id);
      if (error) throw error;
      const textChanged = title.trim() !== (orig?.title ?? '') || vibe.trim() !== (orig?.vibe ?? '');
      if (textChanged) {
        supabase.functions
          .invoke('embed-vibe', { body: { table: 'projects', id, text: `${title.trim()}\n\n${vibe.trim()}` } })
          .catch((e) => console.warn('embed-vibe failed:', e?.message ?? e));
      }
      // Saved — leave without the dirty-guard prompt (nothing to discard).
      commit(() => router.back());
    } catch (e: any) {
      Alert.alert("Couldn't save", e?.message ?? 'Try again.');
      setSaving(false);
    }
  };

  const del = () => {
    Alert.alert('Delete this project?', 'This permanently removes it, ends any open conversations with candidates, and anyone who saved it will see it disappear.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!id) return;
          const { error } = await supabase.from('projects').delete().eq('id', id);
          if (error) { Alert.alert('Delete failed', error.message); return; }
          // Deleted — leave without the dirty-guard prompt.
          commit(() => router.back());
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
    ownerAvatarId: owner.avatarId,
    ownerOpenToNearby: owner.openToNearby,
    whyMatched: '',
    skillsSought: skillsForRoles(roles),
    rolesSought: roles,
    gradient: gradFor(id ?? 'preview'),
    imageUri: pickedUri ?? coverUrl,
    neededBy: neededBy ? toDateOnly(neededBy) : null,
  }), [id, user?.id, title, vibe, owner, roles, pickedUri, coverUrl, neededBy]);

  if (loading) {
    return (
      <View style={[styles.root, styles.center]}>
        <BackChevron onPress={() => router.back()} />
        <ActivityIndicator color={Brand.accent} />
      </View>
    );
  }

  // Invalid id / not found / not owner → honest error state with a way back,
  // never an endless spinner.
  if (loadError) {
    return (
      <View style={[styles.root, styles.center]}>
        <BackChevron onPress={() => router.back()} />
        <View style={styles.errorWrap}>
          <Text style={styles.errorTitle}>Can't open this project</Text>
          <Text style={styles.errorBody}>{loadError}</Text>
          <Pressable onPress={() => router.back()} style={styles.errorBtn} accessibilityRole="button">
            <Text style={styles.errorBtnText}>Go back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <BackChevron onPress={() => guardBack(() => router.back())} />
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
          {/* Show the reach button half-transparent + non-interactive: fills the
              bottom-right gutter so the content stack isn't squished left, and
              previews the seeker's reach-out CTA (owner can't tap their own). */}
          <DiscoveryCard card={previewCard} showReachButton reachDisabled />
        </View>
      ) : (
        <>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={{ height: 12 }} />
            <Text style={styles.kicker}>EDIT PROJECT</Text>

        <View style={styles.field}>
          <TextField label="Project name" value={title} onChangeText={setTitle} maxLength={60} />
        </View>
        <View style={styles.field}>
          <TextField
            label="One line that captures it"
            value={vibe}
            onChangeText={setVibe}
            textarea
            maxLength={140}
            helper={blurbCheck.reason ?? undefined}
          />
        </View>

        <ProjectCoverField uri={pickedUri ?? coverUrl} onChange={setPickedUri} />
        <ProjectDeadlineField value={neededBy} onChange={setNeededBy} />

        <Text style={styles.secLabel}>ROLES YOU'RE HIRING</Text>
        <View style={styles.chips}>
          {allRoles.map((r) => (
            <SteerChip key={r} label={r} selected={roles.includes(r)} onPress={() => toggleRole(r)} />
          ))}
        </View>
        {roles.length === 0 ? <Text style={styles.helper}>Pick at least one role to save.</Text> : null}

        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleLabel}>{active ? 'Active' : 'Paused'}</Text>
            <Text style={styles.toggleHelp}>
              {active ? "Showing in seekers' discovery feed." : 'Hidden from discovery until you reactivate.'}
            </Text>
          </View>
          <Switch value={active} onValueChange={setActive} trackColor={{ false: Brand.borderDefault, true: Brand.action }} thumbColor={Brand.canvas} />
        </View>

        <Pressable onPress={del} style={styles.deleteBtn}>
          <Trash size={18} color={Brand.danger} weight="regular" />
          <Text style={styles.deleteLabel}>Delete project</Text>
        </Pressable>

        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={[styles.ctaWrap, { bottom: insets.bottom + 24 }]}>
        <Button title={saving ? 'Saving…' : 'Save changes'} onPress={save} disabled={!valid || saving} />
      </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.cardCream },
  center: { alignItems: 'center', justifyContent: 'center' },
  errorWrap: { paddingHorizontal: 40, alignItems: 'center' },
  errorTitle: { fontFamily: AmbitFont.display, fontSize: 24, color: Brand.inkPrimary, textAlign: 'center' },
  errorBody: { fontFamily: AmbitFont.body, fontSize: 14.5, color: Brand.inkMuted, textAlign: 'center', marginTop: 12, lineHeight: 21 },
  errorBtn: {
    marginTop: 28,
    backgroundColor: Brand.action,
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: Radii.sm,
  },
  errorBtnText: { fontFamily: AmbitFont.semibold, fontSize: 15, color: Brand.inkOnBrand },

  // Edit | Preview segment (mirrors profile)
  segHeader: { alignItems: 'center', paddingBottom: 12 },
  segment: { flexDirection: 'row', backgroundColor: Brand.surface2, borderRadius: Radii.sm, padding: 4 },
  segmentBtn: { paddingHorizontal: 24, paddingVertical: 8, borderRadius: Radii.sm },
  segmentBtnActive: { backgroundColor: Brand.action },
  segmentText: { fontFamily: AmbitFont.semibold, fontSize: 14, color: Brand.inkMuted },
  segmentTextActive: { color: Brand.inkOnBrand },
  previewWrap: { flex: 1, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },

  scroll: { flex: 1 },
  content: { paddingHorizontal: 28 },
  kicker: { fontFamily: AmbitFont.semibold, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase', color: Brand.inkMuted, marginBottom: 4 },

  field: { marginTop: 32 },
  helper: { fontFamily: AmbitFont.body, fontSize: 13, color: Brand.inkMuted, marginTop: 10, lineHeight: 18 },

  secLabel: { fontFamily: AmbitFont.semibold, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: Brand.inkLabel, marginTop: 36, marginBottom: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  chip: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: Radii.sm, backgroundColor: Brand.cardCream, borderWidth: 1, borderColor: Astra.hairlinePurple },
  chipOn: { backgroundColor: Brand.action, borderColor: Brand.action },
  chipText: { fontFamily: AmbitFont.medium, fontSize: 14.5, color: Brand.inkPrimary },
  chipTextOn: { color: Brand.inkOnBrand, fontFamily: AmbitFont.semibold },

  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 16, marginTop: 36, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Brand.borderSoft },
  toggleLabel: { fontFamily: AmbitFont.semibold, fontSize: 15, color: Brand.inkPrimary },
  toggleHelp: { fontFamily: AmbitFont.body, fontSize: 12.5, color: Brand.inkMuted, marginTop: 3, lineHeight: 17 },

  deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 16, marginTop: 8 },
  deleteLabel: { fontFamily: AmbitFont.semibold, fontSize: 15, color: Brand.danger },

  ctaWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
});
