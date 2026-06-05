import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Camera,
  Chat,
  Check,
  MapPin,
  PencilSimpleLine,
  Plus,
  SignOut,
  X,
} from 'phosphor-react-native';
import { Chip } from '../../components/atoms';
import { router } from 'expo-router';
import {
  AddPortfolioBubble,
  DiscoveryCard,
  OwnerProfileCard,
  PortfolioBubble,
  PortfolioModal,
  SpeechBubble,
} from '../../components/molecules';
import type { OwnerProject } from '../../components/molecules';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { readLocalFileAsArrayBuffer } from '../../lib/messaging';
import {
  deletePortfolioItem,
  fetchPortfolioForUser,
  uploadPortfolioImage,
  upsertPortfolioItem,
} from '../../lib/portfolio';
import { randomUUID } from 'expo-crypto';
import { formatResponseRate, formatResponseTime } from '../../lib/closureLoop';
import { CAMPUSES, SKILL_CATEGORIES } from '../../data/mock';
import type { PortfolioItem, SeekerCardData } from '../../data/mock';
import {
  AmbitFont,
  Brand,
  Radii,
  Space,
  TypeScale,
} from '../../constants/theme';

interface ProfileRow {
  id: string;
  name: string | null;
  vibe_blurb: string | null;
  skills: string[] | null;
  role: 'owner' | 'seeker' | null;
  campus_id: string | null;
  photo_url: string | null;
  /// Closure-loop cache: fraction of reach-outs acted on within 72h.
  /// null until the user has at least one conversation aged past 72h.
  response_rate: number | null;
  avg_response_minutes: number | null;
}

const ROLE_LABEL: Record<NonNullable<ProfileRow['role']>, string> = {
  seeker: 'Looking to join a project',
  owner:  'Recruiting for my project',
};
const ROLE_OPTIONS: NonNullable<ProfileRow['role']>[] = ['seeker', 'owner'];

const PORTFOLIO_GRADIENTS: [string, string][] = [
  [Brand.primary, Brand.accent],
  ['#C9A57A', Brand.seekerInk],
  [Brand.seekerSurface, Brand.accent],
  ['#E8C9A0', Brand.primary],
  [Brand.accent, '#7A5A38'],
];

/// S-090 Profile — live editable WYSIWYG version of the user's seeker card.
///
/// Layout mirrors what an owner sees in discovery (DiscoveryCard's seeker
/// variant), but each field is tappable: photo opens the picker, name/vibe
/// open inline text editors, skills/campus open chip-pickers, portfolio
/// bubbles open the existing PortfolioModal in edit mode.
///
/// Persistence:
///   - name, vibe, skills, campus, photo  → profiles table (Supabase)
///   - portfolio                          → local state for v1.
///                                          Will move to a portfolio_items
///                                          table once schema lands.
export default function ProfileTab() {
  const { user, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);

  // Portfolio is now persisted in Supabase via lib/portfolio.ts.
  // Local state mirrors the DB for snappy UI; mutations write through
  // optimistically and reconcile from the network on save errors.
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);

  // Preview (read-only discovery card) vs. edit mode. Opens in preview so the
  // user sees exactly how owners see them, Instagram-style, then taps Edit.
  const [editing, setEditing] = useState(false);
  const [ownerProjects, setOwnerProjects] = useState<OwnerProject[]>([]);

  // Edit modal state
  const [textEdit, setTextEdit] = useState<TextEditState | null>(null);
  const [skillsOpen, setSkillsOpen] = useState(false);
  const [campusOpen, setCampusOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const [activePortfolio, setActivePortfolio] = useState<PortfolioItem | null>(null);

  // Initial fetch
  //
  // Two-phase: first try the full select (including the closure-loop
  // response-rate columns). If the column doesn't exist in this
  // project's schema (the closure-loop migration may not be applied
  // yet), Postgres returns a column-doesn't-exist error and the WHOLE
  // query fails — wiping the user's profile to null and rendering
  // every field as "Tap to add…". So we fall back to the baseline
  // select that's guaranteed to work, and just leave the response-rate
  // pill hidden.
  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      const full = await supabase
        .from('profiles')
        .select('id, name, vibe_blurb, skills, role, campus_id, photo_url, response_rate, avg_response_minutes')
        .eq('id', user.id)
        .maybeSingle();
      if (cancelled) return;

      if (!full.error) {
        setProfile(full.data as ProfileRow | null);
        setLoading(false);
        return;
      }

      // Likely a missing column — log it once, then retry with the
      // baseline columns so the rest of the editor still works.
      console.warn(
        'profile fetch (full) failed, retrying baseline:',
        full.error.message,
      );
      const base = await supabase
        .from('profiles')
        .select('id, name, vibe_blurb, skills, role, campus_id, photo_url')
        .eq('id', user.id)
        .maybeSingle();
      if (cancelled) return;
      if (base.error) {
        console.warn('profile fetch (baseline) also failed:', base.error.message);
        setProfile(null);
      } else {
        setProfile(
          base.data
            ? ({ ...(base.data as object), response_rate: null, avg_response_minutes: null } as ProfileRow)
            : null,
        );
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  const campus = useMemo(
    () => CAMPUSES.find((c) => c.id === profile?.campus_id) ?? null,
    [profile?.campus_id],
  );

  /// Update a single Supabase column and mirror the change locally for
  /// immediate UI feedback. We don't wait for the round-trip — optimistic
  /// updates feel snappy. Errors are logged so silent failures (RLS
  /// denial, schema mismatch, etc.) show up in the dev console instead
  /// of producing a UI that pretends the save worked.
  const updateField = async (field: keyof ProfileRow, value: ProfileRow[keyof ProfileRow]) => {
    if (!user) return;
    setProfile((p) => (p ? { ...p, [field]: value } : p));
    const { error } = await supabase.from('profiles').update({ [field]: value }).eq('id', user.id);
    if (error) {
      console.warn(`profile.${String(field)} update failed:`, error.message);
    }
  };

  const pickPhoto = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled || !user) return;
    const asset = result.assets[0];

    // Show the local URI immediately so the UI updates without waiting.
    setProfile((p) => (p ? { ...p, photo_url: asset.uri } : p));

    // Upload + persist real URL in the background. Use the ArrayBuffer
    // route from readLocalFileAsArrayBuffer — fetch().blob() silently
    // produces 0-byte uploads on React Native and leaves the avatar as
    // a gray placeholder everywhere it renders.
    try {
      const ext = (asset.uri.match(/\.([a-zA-Z0-9]+)$/)?.[1] ?? 'jpg').toLowerCase();
      const path = `${user.id}/avatar.${ext}`;
      const bytes = await readLocalFileAsArrayBuffer(asset.uri);
      await supabase.storage
        .from('avatars')
        .upload(path, bytes, { upsert: true, contentType: `image/${ext}` });
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      await supabase.from('profiles').update({ photo_url: data.publicUrl }).eq('id', user.id);
      setProfile((p) => (p ? { ...p, photo_url: data.publicUrl } : p));
    } catch (e: any) {
      console.warn('Avatar upload failed:', e?.message ?? e);
    }
  };

  // ── Portfolio CRUD (Supabase-backed) ──────────────────────────────────────

  // Initial portfolio load — runs once when the user becomes known.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const items = await fetchPortfolioForUser(user.id);
      if (!cancelled) setPortfolio(items);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  // Owner's live (active) projects — drives the owner profile preview card.
  useEffect(() => {
    if (!user || profile?.role !== 'owner') { setOwnerProjects([]); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('projects')
        .select('id, title, vibe_blurb, roles_sought')
        .eq('owner_id', user.id)
        .eq('active', true)
        .order('created_at', { ascending: false });
      if (cancelled) return;
      setOwnerProjects(
        (data ?? []).map((p: { id: string; title: string | null; vibe_blurb: string | null; roles_sought: string[] | null }) => ({
          id: p.id,
          title: p.title ?? '',
          pitch: p.vibe_blurb ?? '',
          roles: p.roles_sought ?? [],
        })),
      );
    })();
    return () => { cancelled = true; };
  }, [user?.id, profile?.role]);

  /// Save: optimistic local update + write-through. If the write
  /// fails, the next focus refetch will reconcile back to truth.
  const handleSavePortfolio = async (updated: PortfolioItem) => {
    if (!user) return;
    const exists = portfolio.some((p) => p.id === updated.id);
    const position = exists
      ? portfolio.findIndex((p) => p.id === updated.id)
      : portfolio.length;
    // Optimistic local mirror (shows the local image URI immediately).
    setPortfolio((prev) =>
      exists ? prev.map((p) => (p.id === updated.id ? updated : p)) : [...prev, updated],
    );
    setActivePortfolio(null);
    try {
      // A freshly-picked cover is a local file:// URI — upload it to the
      // portfolio-images bucket and persist the public URL. Already-remote
      // URLs (http) pass through untouched.
      let imageUrl = updated.imageUri;
      if (imageUrl && imageUrl.startsWith('file:')) {
        try {
          imageUrl = await uploadPortfolioImage(user.id, updated.id, imageUrl, Date.now());
          const remote = imageUrl;
          setPortfolio((prev) => prev.map((p) => (p.id === updated.id ? { ...p, imageUri: remote } : p)));
        } catch (imgErr: any) {
          console.warn('portfolio image upload failed:', imgErr?.message ?? imgErr);
          imageUrl = exists ? portfolio.find((p) => p.id === updated.id)?.imageUri ?? null : null;
        }
      }
      await upsertPortfolioItem({
        userId:        user.id,
        id:            updated.id,
        title:         updated.title,
        description:   updated.description,
        imageUrl,
        timeframe:     updated.timeframe,
        contributions: updated.contributions,
        linkUrl:       updated.linkUrl,
        tools:         updated.tools,
        position,
      });
    } catch (e: any) {
      console.warn('portfolio upsert failed:', e?.message ?? e);
      // Refetch to reconcile if the write actually failed.
      const items = await fetchPortfolioForUser(user.id);
      setPortfolio(items);
    }
  };

  const handleDeletePortfolio = async (id: string) => {
    setPortfolio((prev) => prev.filter((p) => p.id !== id));
    setActivePortfolio(null);
    try {
      await deletePortfolioItem(id);
    } catch (e: any) {
      console.warn('portfolio delete failed:', e?.message ?? e);
      if (user) {
        const items = await fetchPortfolioForUser(user.id);
        setPortfolio(items);
      }
    }
  };

  const addNewPortfolio = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    // Real UUID so the DB upsert lands on the same row when the user
    // hits Save in the PortfolioModal. The old slug-style id ('new-...')
    // would have made the DB treat every save as a fresh insert.
    setActivePortfolio({
      id:          randomUUID(),
      imageUri:    null,
      title:       '',
      description: '',
      gradient:    PORTFOLIO_GRADIENTS[portfolio.length % PORTFOLIO_GRADIENTS.length],
    });
  };

  if (loading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={Brand.accent} />
      </View>
    );
  }

  const initial = (profile?.name ?? '?')[0]?.toUpperCase() ?? '?';
  const skills = profile?.skills ?? [];

  // The user's own card, shaped exactly like a discovery seeker card so the
  // preview is pixel-identical to what owners swipe through.
  const previewCard: SeekerCardData = {
    kind: 'seeker',
    id: user?.id ?? 'me',
    name: profile?.name ?? '',
    photoUri: profile?.photo_url ?? null,
    campusId: profile?.campus_id ?? '',
    skills,
    vibeBlurb: profile?.vibe_blurb ?? '',
    portfolio,
  };

  return (
    <View style={styles.root}>
      {/* Header — minimal: an eyebrow label so the user knows they're in
          edit mode, plus a sign-out button in the corner. */}
      {/* Just clear the safe area — no extra top gap. The 44px header band
          centers the eyebrow + sign-out button, giving a snug top that sits
          right below the Dynamic Island. */}
      <View style={[styles.header, { marginTop: insets.top }]}>
        <View style={styles.segment}>
          <Pressable
            onPress={() => { if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {}); setEditing(true); }}
            style={[styles.segmentBtn, editing && styles.segmentBtnActive]}
            accessibilityLabel="Edit profile"
          >
            <Text style={[styles.segmentText, editing && styles.segmentTextActive]}>Edit</Text>
          </Pressable>
          <Pressable
            onPress={() => { if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {}); setEditing(false); }}
            style={[styles.segmentBtn, !editing && styles.segmentBtnActive]}
            accessibilityLabel="Preview profile"
          >
            <Text style={[styles.segmentText, !editing && styles.segmentTextActive]}>Preview</Text>
          </Pressable>
        </View>
        <Pressable
          onPress={() => { signOut().catch(() => {}); }}
          style={styles.signOutBtn}
          hitSlop={10}
          accessibilityLabel="Sign out"
        >
          <SignOut size={18} color={Brand.inkMuted} weight="regular" />
        </Pressable>
      </View>

      {editing ? (
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Photo */}
        <Pressable onPress={pickPhoto} style={styles.photoRow}>
          <View style={styles.photoThumb}>
            {profile?.photo_url
              ? <Image source={{ uri: profile.photo_url }} style={styles.photoThumbImg} />
              : <Text style={styles.photoThumbInitial}>{initial}</Text>}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldRowLabel}>Photo</Text>
            <Text style={styles.fieldRowValueStacked}>
              {profile?.photo_url ? 'Tap to change' : 'Add a photo'}
            </Text>
          </View>
          <Camera size={18} color={Brand.inkMuted} weight="regular" />
        </Pressable>

        {/* Core fields — labeled list (Tinder / Hinge convention) */}
        <View style={styles.fieldGroup}>
          <FieldRow
            label="Name"
            value={profile?.name ?? ''}
            placeholder="Add your name"
            onPress={() => setTextEdit({ field: 'name', title: 'Your name', value: profile?.name ?? '', placeholder: 'Alex Chen', multiline: false })}
          />
          <FieldRow
            label="About"
            stacked
            value={profile?.vibe_blurb ?? ''}
            placeholder="Two sentences on how you like to work"
            onPress={() => setTextEdit({ field: 'vibe_blurb', title: 'Your vibe', value: profile?.vibe_blurb ?? '', placeholder: 'Two sentences about how you like to work.', multiline: true })}
          />
          <FieldRow
            label="Campus"
            value={campus?.name ?? ''}
            placeholder="Set your campus"
            onPress={() => setCampusOpen(true)}
          />
          <FieldRow
            label="Looking to"
            value={profile?.role ? ROLE_LABEL[profile.role] : ''}
            placeholder="Pick a role"
            onPress={() => setRoleOpen(true)}
            last
          />
        </View>

        {/* Skills */}
        <View style={styles.editSection}>
          <View style={styles.editSectionHead}>
            <Text style={styles.sectionLabel}>SKILLS</Text>
            <Pressable onPress={() => setSkillsOpen(true)} hitSlop={8}>
              <Text style={styles.editLink}>{skills.length === 0 ? 'Add' : 'Edit'}</Text>
            </Pressable>
          </View>
          <View style={styles.chipRow}>
            {skills.length === 0
              ? <Text style={styles.fieldRowEmpty}>No skills added yet</Text>
              : skills.map((s) => <Chip key={s} label={s} selected={false} />)}
          </View>
        </View>

        {/* Owners → Live projects; seekers → Portfolio. */}
        {profile?.role === 'owner' ? (
          <View style={styles.editSection}>
            <View style={styles.editSectionHead}>
              <Text style={styles.sectionLabel}>LIVE PROJECTS</Text>
              <Pressable onPress={() => router.push('/projects')} hitSlop={8}>
                <Text style={styles.editLink}>Manage</Text>
              </Pressable>
            </View>
            {ownerProjects.length === 0 ? (
              <Pressable onPress={() => router.push('/project-new')} style={styles.projAddRow}>
                <Plus size={16} color={Brand.accent} weight="bold" />
                <Text style={styles.projAddText}>Create your first project</Text>
              </Pressable>
            ) : (
              ownerProjects.map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => router.push({ pathname: '/project-manage', params: { id: p.id } })}
                  style={styles.projEditRow}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.projEditTitle} numberOfLines={1}>{p.title}</Text>
                    <Text style={styles.projEditSub} numberOfLines={1}>
                      {p.roles.length ? `Looking for · ${p.roles.join(' · ')}` : 'Active'}
                    </Text>
                  </View>
                  <PencilSimpleLine size={15} color={Brand.inkMuted} weight="regular" />
                </Pressable>
              ))
            )}
          </View>
        ) : (
          <View style={styles.editSection}>
            <Text style={styles.sectionLabel}>PORTFOLIO</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.portfolioRow}
            >
              {portfolio.map((item) => (
                <PortfolioBubble
                  key={item.id}
                  item={item}
                  onPress={() => setActivePortfolio(item)}
                  active={activePortfolio?.id === item.id}
                />
              ))}
              <AddPortfolioBubble
                onPress={addNewPortfolio}
                label={portfolio.length === 0 ? 'Add first' : 'Add'}
              />
            </ScrollView>
          </View>
        )}

        <View style={{ height: Space.xl }} />
      </ScrollView>
      ) : (
        <View style={styles.previewWrap}>
          {profile?.role === 'owner' ? (
            <OwnerProfileCard
              name={profile?.name ?? ''}
              photoUri={profile?.photo_url ?? null}
              campusName={campus?.name ?? null}
              vibe={profile?.vibe_blurb ?? ''}
              skills={skills}
              projects={ownerProjects}
              onProjectPress={(id) => router.push({ pathname: '/project-manage', params: { id } })}
            />
          ) : (
            <DiscoveryCard
              card={previewCard}
              showReachButton={false}
              onPortfolioPress={setActivePortfolio}
              activePortfolioId={activePortfolio?.id ?? null}
            />
          )}
        </View>
      )}

      {/* ── Edit modals ────────────────────────────────────────────────── */}
      <TextEditModal
        state={textEdit}
        onCancel={() => setTextEdit(null)}
        onSave={(value) => {
          if (textEdit) updateField(textEdit.field, value);
          setTextEdit(null);
        }}
      />

      <SkillsEditModal
        visible={skillsOpen}
        selected={skills}
        onCancel={() => setSkillsOpen(false)}
        onSave={(next) => {
          updateField('skills', next);
          setSkillsOpen(false);
        }}
      />

      <CampusEditModal
        visible={campusOpen}
        selected={profile?.campus_id ?? null}
        onCancel={() => setCampusOpen(false)}
        onSave={(id) => {
          updateField('campus_id', id);
          setCampusOpen(false);
        }}
      />

      <RoleEditModal
        visible={roleOpen}
        selected={profile?.role ?? null}
        onCancel={() => setRoleOpen(false)}
        onSave={(role) => {
          updateField('role', role);
          setRoleOpen(false);
        }}
      />

      <PortfolioModal
        item={activePortfolio}
        onDismiss={() => setActivePortfolio(null)}
        onSave={handleSavePortfolio}
        onDelete={handleDeletePortfolio}
      />
    </View>
  );
}

/// One labeled, tappable row in the profile editor (Tinder/Hinge field list).
function FieldRow({
  label,
  value,
  placeholder,
  onPress,
  stacked,
  last,
}: {
  label: string;
  value: string;
  placeholder: string;
  onPress: () => void;
  stacked?: boolean;
  last?: boolean;
}) {
  const empty = !value.trim();
  return (
    <Pressable onPress={onPress} style={[styles.fieldRow, !last && styles.fieldRowDivider]}>
      {stacked ? (
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={styles.fieldRowLabel}>{label}</Text>
          <Text style={[styles.fieldRowValueStacked, empty && styles.fieldRowEmpty]} numberOfLines={2}>
            {empty ? placeholder : value}
          </Text>
        </View>
      ) : (
        <>
          <Text style={styles.fieldRowLabel}>{label}</Text>
          <Text style={[styles.fieldRowValue, empty && styles.fieldRowEmpty]} numberOfLines={1}>
            {empty ? placeholder : value}
          </Text>
        </>
      )}
      <PencilSimpleLine size={15} color={Brand.inkMuted} weight="regular" />
    </Pressable>
  );
}

// ─── TextEditModal (name, vibe) ──────────────────────────────────────────

interface TextEditState {
  field: keyof ProfileRow;
  title: string;
  value: string;
  placeholder: string;
  multiline: boolean;
}

function TextEditModal({
  state,
  onCancel,
  onSave,
}: {
  state: TextEditState | null;
  onCancel: () => void;
  onSave: (value: string) => void;
}) {
  const [draft, setDraft] = useState('');

  useEffect(() => {
    setDraft(state?.value ?? '');
  }, [state]);

  if (!state) return null;
  const canSave = draft.trim().length > 0;

  return (
    <Modal transparent animationType="fade" visible={!!state} onRequestClose={onCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={modalStyles.root}
      >
        <Pressable style={modalStyles.scrim} onPress={onCancel} />
        <View style={modalStyles.sheet}>
          <View style={modalStyles.sheetHeader}>
            <Text style={modalStyles.sheetTitle}>{state.title}</Text>
            <Pressable onPress={onCancel} hitSlop={10}>
              <X size={20} color={Brand.inkMuted} weight="bold" />
            </Pressable>
          </View>

          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={state.placeholder}
            placeholderTextColor={Brand.inkPlaceholder}
            multiline={state.multiline}
            autoFocus
            maxLength={state.multiline ? 280 : 60}
            style={[
              modalStyles.input,
              state.multiline && modalStyles.inputMultiline,
            ]}
          />

          <View style={modalStyles.footer}>
            <Pressable
              onPress={() => canSave && onSave(draft.trim())}
              disabled={!canSave}
              style={[modalStyles.saveBtn, !canSave && { opacity: 0.45 }]}
            >
              <Check size={16} color={Brand.inkOnBrand} weight="bold" />
              <Text style={modalStyles.saveLabel}>Save</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── SkillsEditModal — multi-select chips ────────────────────────────────

function SkillsEditModal({
  visible,
  selected,
  onCancel,
  onSave,
}: {
  visible: boolean;
  selected: string[];
  onCancel: () => void;
  onSave: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState<string[]>(selected);
  const [customInput, setCustomInput] = useState('');

  useEffect(() => {
    if (visible) { setDraft(selected); setCustomInput(''); }
  }, [visible, selected]);

  const allPreset = new Set(SKILL_CATEGORIES.flatMap((c) => c.tags));
  const customSkills = draft.filter((s) => !allPreset.has(s));
  const MAX_SKILLS = 8;

  const toggle = (skill: string) => {
    setDraft((d) => (d.includes(skill) ? d.filter((s) => s !== skill) : d.length < MAX_SKILLS ? [...d, skill] : d));
  };

  const addCustom = () => {
    const skill = customInput.trim();
    if (!skill || draft.includes(skill) || draft.length >= MAX_SKILLS) return;
    setDraft((d) => [...d, skill]);
    setCustomInput('');
  };

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onCancel}>
      <View style={modalStyles.root}>
        <Pressable style={modalStyles.scrim} onPress={onCancel} />
        <View style={[modalStyles.sheet, { maxHeight: '80%' }]}>
          <View style={modalStyles.sheetHeader}>
            <Text style={modalStyles.sheetTitle}>Your skills · {draft.length} / {MAX_SKILLS}</Text>
            <Pressable onPress={onCancel} hitSlop={10}>
              <X size={20} color={Brand.inkMuted} weight="bold" />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={{ gap: Space.lg, paddingBottom: Space.lg }}
            keyboardShouldPersistTaps="handled"
          >
            {customSkills.length > 0 && (
              <View style={{ gap: 10 }}>
                <Text style={styles.sectionLabel}>ADDED BY YOU</Text>
                <View style={styles.chipRow}>
                  {customSkills.map((s) => (
                    <Chip key={s} label={s} selected onPress={() => toggle(s)} />
                  ))}
                </View>
              </View>
            )}
            {SKILL_CATEGORIES.map((cat) => (
              <View key={cat.label} style={{ gap: 10 }}>
                <Text style={styles.sectionLabel}>{cat.label}</Text>
                <View style={styles.chipRow}>
                  {cat.tags.map((tag) => (
                    <Chip
                      key={tag}
                      label={tag}
                      selected={draft.includes(tag)}
                      onPress={() => toggle(tag)}
                    />
                  ))}
                </View>
              </View>
            ))}
            <View style={styles.customRow}>
              <TextInput
                value={customInput}
                onChangeText={setCustomInput}
                placeholder="Add a skill…"
                placeholderTextColor={Brand.inkPlaceholder}
                style={styles.customInput}
                returnKeyType="done"
                onSubmitEditing={addCustom}
                autoCapitalize="words"
                blurOnSubmit={false}
              />
              <Pressable
                onPress={addCustom}
                style={[styles.customAddBtn, (!customInput.trim() || draft.length >= MAX_SKILLS) && styles.customAddBtnDisabled]}
              >
                <Plus size={16} color={Brand.inkOnBrand} weight="bold" />
              </Pressable>
            </View>
          </ScrollView>

          <View style={modalStyles.footer}>
            <Pressable onPress={() => onSave(draft)} style={modalStyles.saveBtn}>
              <Check size={16} color={Brand.inkOnBrand} weight="bold" />
              <Text style={modalStyles.saveLabel}>Save</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── CampusEditModal — single-select list ────────────────────────────────

function CampusEditModal({
  visible,
  selected,
  onCancel,
  onSave,
}: {
  visible: boolean;
  selected: string | null;
  onCancel: () => void;
  onSave: (id: string) => void;
}) {
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onCancel}>
      <View style={modalStyles.root}>
        <Pressable style={modalStyles.scrim} onPress={onCancel} />
        <View style={modalStyles.sheet}>
          <View style={modalStyles.sheetHeader}>
            <Text style={modalStyles.sheetTitle}>Where do you go?</Text>
            <Pressable onPress={onCancel} hitSlop={10}>
              <X size={20} color={Brand.inkMuted} weight="bold" />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ gap: 8 }}>
            {CAMPUSES.map((c) => {
              const isSelected = c.id === selected;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => onSave(c.id)}
                  style={[
                    modalStyles.campusRow,
                    isSelected && modalStyles.campusRowSelected,
                  ]}
                >
                  <MapPin
                    size={16}
                    color={isSelected ? Brand.seekerInk : Brand.inkMuted}
                    weight={isSelected ? 'fill' : 'regular'}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        modalStyles.campusName,
                        isSelected && { color: Brand.seekerInk },
                      ]}
                    >
                      {c.name}
                    </Text>
                    <Text style={modalStyles.campusCity}>{c.city}</Text>
                  </View>
                  {isSelected && <Check size={18} color={Brand.seekerInk} weight="bold" />}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── RoleEditModal — single-select 3-option picker ───────────────────────

function RoleEditModal({
  visible,
  selected,
  onCancel,
  onSave,
}: {
  visible: boolean;
  selected: ProfileRow['role'];
  onCancel: () => void;
  onSave: (role: NonNullable<ProfileRow['role']>) => void;
}) {
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onCancel}>
      <View style={modalStyles.root}>
        <Pressable style={modalStyles.scrim} onPress={onCancel} />
        <View style={modalStyles.sheet}>
          <View style={modalStyles.sheetHeader}>
            <Text style={modalStyles.sheetTitle}>What are you here for?</Text>
            <Pressable onPress={onCancel} hitSlop={10}>
              <X size={20} color={Brand.inkMuted} weight="bold" />
            </Pressable>
          </View>

          <View style={{ gap: 8 }}>
            {ROLE_OPTIONS.map((r) => {
              const isSelected = r === selected;
              return (
                <Pressable
                  key={r}
                  onPress={() => onSave(r)}
                  style={[
                    modalStyles.campusRow,
                    isSelected && modalStyles.campusRowSelected,
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        modalStyles.campusName,
                        isSelected && { color: Brand.seekerInk },
                      ]}
                    >
                      {ROLE_LABEL[r]}
                    </Text>
                  </View>
                  {isSelected && <Check size={18} color={Brand.seekerInk} weight="bold" />}
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.canvas },
  center: { alignItems: 'center', justifyContent: 'center' },

  header: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    ...TypeScale.labelSm,
    color: Brand.inkLabel,
  },
  signOutBtn: {
    position: 'absolute',
    right: Space.lg,
    top: 0,
    bottom: 0,
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: Space.lg, paddingTop: Space.md },

  // Preview mode — the real discovery card, filling the screen like the deck.
  previewWrap: { flex: 1, paddingHorizontal: Space.lg, paddingTop: Space.sm, paddingBottom: Space.md },

  // Segmented Edit | Preview control (centered in the header band).
  segment: { flexDirection: 'row', backgroundColor: Brand.cardCream, borderWidth: 1.5, borderColor: Brand.inkEdge, borderRadius: 999, padding: 3 },
  segmentBtn: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 999 },
  segmentBtnActive: {
    backgroundColor: Brand.action,
    shadowColor: Brand.inkEdge,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 2 },
    elevation: 0,
  },
  segmentText: { fontFamily: AmbitFont.body, fontSize: 14, fontWeight: '600', color: Brand.inkMuted },
  segmentTextActive: { color: Brand.actionInk, fontWeight: '700' },

  // Field-list editor (Tinder / Hinge convention).
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  photoThumb: { width: 56, height: 56, borderRadius: 16, backgroundColor: Brand.surface1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photoThumbImg: { width: '100%', height: '100%' },
  photoThumbInitial: { fontFamily: AmbitFont.display, fontSize: 24, color: Brand.inkMuted },
  fieldGroup: { backgroundColor: Brand.surface1, borderRadius: 16, paddingHorizontal: 16 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 15 },
  fieldRowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Brand.borderSoft },
  fieldRowLabel: { fontFamily: AmbitFont.body, fontSize: 15, fontWeight: '600', color: Brand.inkBody },
  fieldRowValue: { flex: 1, textAlign: 'right', fontFamily: AmbitFont.body, fontSize: 15, color: Brand.inkPrimary },
  fieldRowValueStacked: { fontFamily: AmbitFont.body, fontSize: 14, color: Brand.inkPrimary, lineHeight: 19 },
  fieldRowEmpty: { color: Brand.inkMuted, fontWeight: '400' },
  editSection: { marginTop: Space.lg },
  editSectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  editLink: { fontFamily: AmbitFont.body, fontSize: 14, fontWeight: '600', color: Brand.accent },
  projAddRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14 },
  projAddText: { fontFamily: AmbitFont.body, fontSize: 15, fontWeight: '600', color: Brand.accent },
  projEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Brand.borderSoft,
  },
  projEditTitle: { fontFamily: AmbitFont.display, fontSize: 17, color: Brand.inkPrimary },
  projEditSub: { fontFamily: AmbitFont.body, fontSize: 12.5, color: Brand.inkMuted, marginTop: 2 },

  card: {
    backgroundColor: Brand.canvas,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Brand.surface2,
    padding: Space.lg,
    gap: Space.lg,
  },

  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarPressable: {
    position: 'relative',
    width: 56,
    height: 56,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: Radii.full,
    backgroundColor: Brand.seekerSurface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarInitial: {
    fontFamily: AmbitFont.display,
    fontSize: 26,
    color: Brand.seekerInk,
  },
  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: Radii.full,
    backgroundColor: Brand.canvas,
    borderWidth: 1,
    borderColor: Brand.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
  },

  nameCol: { flex: 1, gap: 4 },
  fieldPress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    fontFamily: AmbitFont.display,
    fontSize: 22,
    color: Brand.inkPrimary,
    lineHeight: 28,
    flexShrink: 1,
  },
  campusText: {
    ...TypeScale.helper,
    color: Brand.inkMuted,
    flexShrink: 1,
  },

  // Role pill — what side of the marketplace this card is for.
  // Warm-tan accent border + light fill keeps it visually distinct
  // from neutral campus/name rows, signaling "this is a chooser."
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: Brand.seekerSurface,
    borderWidth: 1,
    borderColor: Brand.accent,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  rolePillText: {
    fontFamily: AmbitFont.body,
    fontSize: 12,
    fontWeight: '600',
    color: Brand.accent,
    letterSpacing: 0.2,
  },

  // Closure-loop response-rate pill (sits under the campus line).
  responseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: Brand.surface1,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  responseText: {
    fontFamily: AmbitFont.body,
    fontSize: 11,
    fontWeight: '600',
    color: Brand.accent,
    letterSpacing: 0.2,
  },

  vibeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  vibe: {
    flex: 1,
    fontFamily: AmbitFont.body,
    fontSize: 15,
    fontStyle: 'italic',
    color: Brand.seekerInk,
    lineHeight: 21,
  },

  section: { gap: 10 },
  sectionLabel: {
    ...TypeScale.labelSm,
    color: Brand.inkLabel,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Space.sm,
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customInput: {
    flex: 1,
    height: 40,
    borderRadius: Radii.pill,
    paddingHorizontal: 16,
    backgroundColor: Brand.surface1,
    borderWidth: 1.5,
    borderColor: Brand.borderDefault,
    fontFamily: AmbitFont.body,
    fontSize: 14,
    color: Brand.inkBody,
  },
  customAddBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customAddBtnDisabled: { opacity: 0.4 },
  addChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radii.pill,
    borderWidth: 1.5,
    borderColor: Brand.accent,
    borderStyle: 'dashed',
  },
  addChipPlus: {
    fontFamily: AmbitFont.body,
    fontSize: 14,
    fontWeight: '700',
    color: Brand.accent,
  },
  addChipLabel: {
    fontFamily: AmbitFont.body,
    fontSize: 13,
    fontWeight: '600',
    color: Brand.accent,
  },

  portfolioRow: {
    gap: 14,
    paddingRight: Space.lg,
  },
});

const modalStyles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  sheet: {
    backgroundColor: Brand.canvas,
    borderTopLeftRadius: Radii.lg + 4,
    borderTopRightRadius: Radii.lg + 4,
    padding: Space.lg,
    gap: Space.md,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetTitle: {
    fontFamily: AmbitFont.display,
    fontSize: 20,
    color: Brand.inkPrimary,
  },
  input: {
    fontFamily: AmbitFont.body,
    fontSize: 16,
    color: Brand.inkBody,
    backgroundColor: Brand.surface1,
    borderRadius: Radii.md,
    padding: 14,
    minHeight: 48,
  },
  inputMultiline: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Brand.primary,
    borderRadius: Radii.md,
  },
  saveLabel: {
    fontFamily: AmbitFont.body,
    fontSize: 14,
    fontWeight: '600',
    color: Brand.inkOnBrand,
  },

  // CampusEditModal
  campusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    backgroundColor: Brand.surface1,
    borderRadius: Radii.md,
  },
  campusRowSelected: {
    backgroundColor: Brand.seekerSurface,
  },
  campusName: {
    fontFamily: AmbitFont.body,
    fontSize: 15,
    fontWeight: '600',
    color: Brand.inkBody,
  },
  campusCity: {
    ...TypeScale.helper,
    color: Brand.inkMuted,
    marginTop: 2,
  },
});
