import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Camera,
  Check,
  FileArrowUp,
  MapPin,
  PencilSimpleLine,
  Plus,
  SignOut,
  X,
} from 'phosphor-react-native';
import { Chip, GlassSurface, HardShadow, Skeleton, TextField } from '../../../components/atoms';
import { router, useFocusEffect } from 'expo-router';
import {
  DiscoveryCard,
  LegalModal,
  OwnerProfileCard,
  PortfolioModal,
} from '../../../components/molecules';
import type { OwnerProject } from '../../../components/molecules';
import { PRIVACY_POLICY, TERMS_OF_USE, type LegalDoc } from '../../../constants/legal';
import { useAuth } from '../../../context/AuthContext';
import { setProfileRoleCache } from '../../../hooks/useProfileRole';
import { supabase } from '../../../lib/supabase';
import { readLocalFileAsArrayBuffer } from '../../../lib/messaging';
import {
  deletePortfolioItem,
  fetchPortfolioForUser,
  uploadPortfolioImage,
  upsertPortfolioItem,
} from '../../../lib/portfolio';
import { randomUUID } from 'expo-crypto';
import { toast } from '../../../lib/toast';
import { optimistic } from '../../../lib/mutation';
import { formatResponseRate, formatResponseTime } from '../../../lib/closureLoop';
import { canonicalizeSkill } from '../../../lib/resume';
import { CAMPUSES, SKILL_CATEGORIES } from '../../../data/mock';
import type { PortfolioItem, SeekerCardData } from '../../../data/mock';
import {
  AmbitFont,
  Astra,
  Brand,
  Radii,
  Space,
  TypeScale,
} from '../../../constants/theme';

interface ProfileRow {
  id: string;
  name: string | null;
  vibe_blurb: string | null;
  skills: string[] | null;
  role: 'owner' | 'seeker' | null;
  campus_id: string | null;
  photo_url: string | null;
  /// Optional phone — only ever shared via the chat contact card, never on
  /// discovery. Null until the user adds one.
  phone: string | null;
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

// Max portfolio highlights a seeker can showcase. Matches the discovery card's
// 2×3 grid, which fills the fixed-height card face at exactly 6.
const PORTFOLIO_MAX = 6;

// ASTRA royal→iris gradient family for portfolio tiles + avatar fallback.
const PORTFOLIO_GRADIENTS: [string, string][] = [
  [Astra.royal, Astra.iris],
  [Astra.iris, Astra.selected],
  [Astra.selected, Astra.royal],
  [Astra.void, Astra.iris],
  [Astra.royal, Astra.selected],
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
  const { user, signOut, deleteAccount } = useAuth();
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  // A genuine read failure (network / RLS) — distinct from a legitimately
  // absent profile row (new user). Drives an error state with Retry instead of
  // rendering editable "Add your name" placeholders over a profile we simply
  // couldn't reach.
  const [loadError, setLoadError] = useState(false);
  // Résumé import → the review/apply screen (paste / file / photo live there).
  const openResumeImport = () => router.push('/resume-import');

  // Portfolio is now persisted in Supabase via lib/portfolio.ts.
  // Local state mirrors the DB for snappy UI; mutations write through
  // optimistically and reconcile from the network on save errors.
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);

  // Preview (read-only discovery card) vs. edit mode. Opens in preview so the
  // user sees exactly how owners see them, Instagram-style, then taps Edit.
  const [editing, setEditing] = useState(false);
  const [ownerProjects, setOwnerProjects] = useState<OwnerProject[]>([]);

  // Inline field drafts (Name + About) — the ASTRA editor edits these in place
  // via TextField and commits through the same optimistic updateField() the
  // pickers use, on blur. Seeded from the profile and re-synced whenever the
  // canonical row changes (focus refetch, résumé import, etc.).
  const [nameDraft, setNameDraft] = useState('');
  const [aboutDraft, setAboutDraft] = useState('');
  const [phoneDraft, setPhoneDraft] = useState('');
  useEffect(() => { setNameDraft(profile?.name ?? ''); }, [profile?.name]);
  useEffect(() => { setAboutDraft(profile?.vibe_blurb ?? ''); }, [profile?.vibe_blurb]);
  useEffect(() => { setPhoneDraft(profile?.phone ?? ''); }, [profile?.phone]);

  // Edit modal state
  const [skillsOpen, setSkillsOpen] = useState(false);
  const [campusOpen, setCampusOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const [activePortfolio, setActivePortfolio] = useState<PortfolioItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [legalDoc, setLegalDoc] = useState<LegalDoc | null>(null);

  // Account deletion (App Store 5.1.1(v)). Two-step confirm — the second
  // Alert spells out that it's permanent — then the edge function wipes the
  // account + data. On success the auth listener clears the session and the
  // root layout routes back to sign-in automatically.
  const confirmDeleteAccount = useCallback(() => {
    Alert.alert(
      'Delete account?',
      'This permanently deletes your Ambit profile, projects, portfolio, messages, and matches.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () =>
            Alert.alert(
              'This can’t be undone',
              'Your account and all associated data will be permanently erased.',
              [
                { text: 'Keep my account', style: 'cancel' },
                {
                  text: 'Delete forever',
                  style: 'destructive',
                  onPress: async () => {
                    setDeleting(true);
                    try {
                      await deleteAccount();
                      // Session cleared → root layout handles navigation.
                    } catch {
                      setDeleting(false);
                      toast.error("Couldn't delete your account. Please try again.");
                    }
                  },
                },
              ],
            ),
        },
      ],
    );
  }, [deleteAccount]);

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
  const loadProfile = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoadError(false);
    const full = await supabase
      .from('profiles')
      .select('id, name, vibe_blurb, skills, role, campus_id, photo_url, phone, response_rate, avg_response_minutes')
      .eq('id', user.id)
      .maybeSingle();
    if (!full.error) {
      setProfile(full.data as ProfileRow | null);
      setLoading(false);
      return;
    }
    // Likely a missing column — log it once, then retry with the baseline
    // columns so the rest of the editor still works.
    console.warn('profile fetch (full) failed, retrying baseline:', full.error.message);
    const base = await supabase
      .from('profiles')
      .select('id, name, vibe_blurb, skills, role, campus_id, photo_url')
      .eq('id', user.id)
      .maybeSingle();
    if (base.error) {
      // A real outage — NOT a missing row (maybeSingle returns null data / no
      // error for that). Surface an error state with Retry so we never render
      // empty editable placeholders over a profile we couldn't read.
      console.warn('profile fetch (baseline) also failed:', base.error.message);
      setLoadError(true);
    } else {
      setProfile(
        base.data
          ? ({ ...(base.data as object), phone: null, response_rate: null, avg_response_minutes: null } as ProfileRow)
          : null,
      );
    }
    setLoading(false);
  }, [user?.id]);

  const campus = useMemo(
    () => CAMPUSES.find((c) => c.id === profile?.campus_id) ?? null,
    [profile?.campus_id],
  );

  /// Update a single Supabase column and mirror the change locally for
  /// immediate UI feedback. Optimistic via the shared helper: the UI moves
  /// instantly, and if the write fails (RLS denial, schema mismatch, etc.)
  /// the local mirror snaps back and the user gets a toast — instead of a UI
  /// that pretends the save worked.
  const updateField = async (field: keyof ProfileRow, value: ProfileRow[keyof ProfileRow]) => {
    if (!user) return;
    await optimistic<ProfileRow | null>({
      apply: () => {
        const prev = profile;
        setProfile((p) => (p ? { ...p, [field]: value } : p));
        return prev;
      },
      commit: async () => {
        const { error } = await supabase.from('profiles').update({ [field]: value }).eq('id', user.id);
        if (error) throw error;
      },
      revert: (prev) => setProfile(prev),
      errorMessage: "Couldn't save that change",
    });
  };

  /// Commit an inline text field on blur — only writes when the trimmed draft
  /// actually diverges from the saved value, so a focus/blur with no change is
  /// a no-op (no needless network write or embed refresh).
  const commitText = (field: 'name' | 'vibe_blurb' | 'phone', draft: string) => {
    const next = draft.trim();
    if (next === (profile?.[field] ?? '')) return;
    updateField(field, next);
  };

  const pickPhoto = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      toast.error('Enable photo access in Settings to add a photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled || !user) return;
    const asset = result.assets[0];

    // Remember the current photo so a failed upload can snap back instead of
    // leaving a local file:// URI on display forever.
    const prevPhoto = profile?.photo_url ?? null;
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
      // Revert the optimistic local URI — the upload never landed, so keep
      // showing the previous (real) avatar rather than a dead file:// path.
      setProfile((p) => (p ? { ...p, photo_url: prevPhoto } : p));
      toast.error("Couldn't upload your photo. Tap to try again.", {
        actionLabel: 'Retry',
        onAction: () => { void pickPhoto(); },
      });
    }
  };

  // ── Portfolio CRUD (Supabase-backed) ──────────────────────────────────────

  const loadPortfolio = useCallback(async () => {
    if (!user) return;
    const items = await fetchPortfolioForUser(user.id);
    setPortfolio(items);
  }, [user?.id]);

  // Reload profile + portfolio every time the tab regains focus — so edits
  // made on a pushed screen (e.g. résumé import) show on return, not just on
  // a cold app start.
  useFocusEffect(
    useCallback(() => {
      loadProfile();
      loadPortfolio();
    }, [loadProfile, loadPortfolio]),
  );

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
          toast.error("Couldn't upload that image — saved the rest.");
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
      toast.error("Couldn't save that project. We've reverted it.");
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
      toast.error("Couldn't delete that highlight. We've put it back.");
      if (user) {
        const items = await fetchPortfolioForUser(user.id);
        setPortfolio(items);
      }
    }
  };

  const addNewPortfolio = () => {
    // Hard cap — a full portfolio can't take a 7th highlight. The Add tile is
    // hidden at the cap, but guard here too in case it's reached another way.
    if (portfolio.length >= PORTFOLIO_MAX) {
      toast.error(`You can showcase up to ${PORTFOLIO_MAX} highlights.`);
      return;
    }
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
    // Mirror the real screen: a header band with the centered Edit|Preview
    // segment + sign-out stub, then the full-bleed preview card silhouette
    // (the profile opens in Preview mode).
    return (
      <View style={styles.root}>
        <View style={[styles.header, { marginTop: insets.top + 6 }]}>
          <Skeleton width={156} height={40} radius={999} />
        </View>
        <View style={styles.previewWrap}>
          <HardShadow radius={Radii.card} offset={7} style={{ flex: 1 }}>
            <View style={styles.skelCard}>
              <Skeleton width={120} height={30} radius={14} style={styles.skelBadge} />
              <View style={styles.skelStack}>
                <Skeleton width={120} height={11} radius={5} />
                <Skeleton width="68%" height={30} radius={8} />
                <View style={{ gap: 7 }}>
                  <Skeleton width="90%" height={15} radius={6} />
                  <Skeleton width="62%" height={15} radius={6} />
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {[70, 92, 64].map((w, i) => (
                    <Skeleton key={i} width={w} height={33} radius={999} />
                  ))}
                </View>
              </View>
            </View>
          </HardShadow>
        </View>
      </View>
    );
  }

  // Distinct error state (not an empty editor) — matches the feed's DeckError
  // language: title + body + a Retry button.
  if (loadError) {
    return (
      <View style={styles.root}>
        <View style={[styles.errorWrap, { paddingTop: insets.top }]}>
          <Text style={styles.errorTitle}>Couldn't load your profile.</Text>
          <Text style={styles.errorBody}>
            Something went wrong reaching the server. Check your connection and try again.
          </Text>
          <HardShadow radius={999} offset={4} style={{ marginTop: 12 }}>
            <Pressable
              onPress={() => { setLoading(true); loadProfile(); }}
              style={styles.errorBtn}
              accessibilityRole="button"
              accessibilityLabel="Retry loading your profile"
            >
              <Text style={styles.errorBtnText}>Retry</Text>
            </Pressable>
          </HardShadow>
        </View>
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
    // Preview parity — the public seeker card shows the reply-tier badge, so
    // the WYSIWYG preview must carry the same rate.
    responseRate: profile?.response_rate ?? null,
  };

  return (
    <View style={styles.root}>
      {/* Glass top bar — the Edit|Preview segment centered on a light-glass
          surface with a lilac bottom hairline. (Résumé import + log out now
          live in the edit form as labeled buttons.) */}
      <GlassSurface intensity={24} tint="light" style={[styles.topBar, { paddingTop: insets.top }]}>
      <View style={styles.header}>
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
      </View>
      </GlassSurface>

      {editing ? (
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Photo — centered squared avatar (royal→iris) + Change photo */}
        <View style={styles.avatarBlock}>
          <Pressable onPress={pickPhoto} style={styles.avatarSquare} accessibilityLabel="Change photo">
            {profile?.photo_url ? (
              <Image source={{ uri: profile.photo_url }} style={styles.avatarSquareImg} cachePolicy="memory-disk" transition={180} />
            ) : (
              <LinearGradient
                colors={[Astra.royal, Astra.iris]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.avatarSquareImg}
              >
                <Text style={styles.avatarSquareInitial}>{initial}</Text>
              </LinearGradient>
            )}
            <View style={styles.cameraChip}>
              <Camera size={14} color={Brand.inkOnBrand} weight="fill" />
            </View>
          </Pressable>
          <Pressable onPress={pickPhoto} hitSlop={8}>
            <Text style={styles.changePhoto}>{profile?.photo_url ? 'Change photo' : 'Add photo'}</Text>
          </Pressable>
        </View>

        {/* Résumé import — a clearly-labeled CTA so the feature is discoverable
            (the header icon alone read as "missing"). Seekers only; owners'
            profiles are project-centric, not portfolio-driven. */}
        {profile?.role === 'seeker' && (
          <HardShadow radius={999} offset={3} style={styles.resumeImportShadow}>
            <Pressable
              onPress={openResumeImport}
              style={styles.resumeImportBtn}
              accessibilityRole="button"
              accessibilityLabel="Resume Import"
            >
              <FileArrowUp size={18} color={Brand.inkOnBrand} weight="regular" />
              <Text style={styles.resumeImportLabel}>Resume Import</Text>
            </Pressable>
          </HardShadow>
        )}

        {/* Core fields — inline TextField editing; commits on blur. Campus +
            role are single-select pickers, so they stay tap-to-open rows. */}
        <View style={styles.fieldStack}>
          <TextField
            label="Name"
            value={nameDraft}
            onChangeText={setNameDraft}
            onEndEditing={() => commitText('name', nameDraft)}
            onBlur={() => commitText('name', nameDraft)}
            placeholder="Add your name"
            maxLength={60}
            returnKeyType="done"
          />
          <TextField
            label="About"
            textarea
            value={aboutDraft}
            onChangeText={setAboutDraft}
            onEndEditing={() => commitText('vibe_blurb', aboutDraft)}
            onBlur={() => commitText('vibe_blurb', aboutDraft)}
            placeholder="Two sentences on how you like to work"
            maxLength={280}
          />
          <TextField
            label="Phone (optional)"
            value={phoneDraft}
            onChangeText={setPhoneDraft}
            onEndEditing={() => commitText('phone', phoneDraft)}
            onBlur={() => commitText('phone', phoneDraft)}
            placeholder="Only shared when you send your contact card"
            keyboardType="phone-pad"
            maxLength={20}
            returnKeyType="done"
          />
          <PickerField
            label="Campus"
            value={campus?.name ?? ''}
            placeholder="Set your campus"
            onPress={() => setCampusOpen(true)}
          />
          <PickerField
            label="Looking to"
            value={profile?.role ? ROLE_LABEL[profile.role] : ''}
            placeholder="Pick a role"
            onPress={() => setRoleOpen(true)}
          />
        </View>

        {/* Skills — owned chips fill #9362C8 (selected), plus a dashed add chip. */}
        <View style={styles.editSection}>
          <Text style={styles.sectionLabel}>SKILLS</Text>
          <View style={styles.chipRow}>
            {skills.map((s) => (
              <Chip key={s} label={s} selected onPress={() => setSkillsOpen(true)} />
            ))}
            <Pressable onPress={() => setSkillsOpen(true)} style={styles.addChip} hitSlop={6} accessibilityLabel="Add skills">
              <Text style={styles.addChipPlus}>＋</Text>
              <Text style={styles.addChipLabel}>Add</Text>
            </Pressable>
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
            <View style={styles.portfolioGrid}>
              {portfolio.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => setActivePortfolio(item)}
                  style={styles.tile}
                  accessibilityLabel={`Edit ${item.title || 'portfolio item'}`}
                >
                  <View style={[styles.tileImgWrap, activePortfolio?.id === item.id && styles.tileActive]}>
                    {item.imageUri ? (
                      <Image source={{ uri: item.imageUri }} style={styles.tileImg} cachePolicy="memory-disk" transition={180} />
                    ) : (
                      <LinearGradient
                        colors={item.gradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.tileImg}
                      >
                        <Text style={styles.tileInitial}>{(item.title[0] ?? '').toUpperCase()}</Text>
                      </LinearGradient>
                    )}
                  </View>
                  <Text style={styles.tileTitle} numberOfLines={1}>{item.title || 'Untitled'}</Text>
                </Pressable>
              ))}
              {portfolio.length < PORTFOLIO_MAX && (
                <Pressable
                  onPress={addNewPortfolio}
                  style={styles.tile}
                  accessibilityLabel="Add portfolio item"
                >
                  <View style={[styles.tileImgWrap, styles.addTile]}>
                    <Plus size={26} color={Brand.selected} weight="bold" />
                  </View>
                  <Text style={[styles.tileTitle, styles.addTileLabel]} numberOfLines={1}>Add</Text>
                </Pressable>
              )}
            </View>
            <Text style={styles.portfolioHint}>
              {portfolio.length >= PORTFOLIO_MAX
                ? `Showcasing the max of ${PORTFOLIO_MAX} highlights.`
                : `${portfolio.length} of ${PORTFOLIO_MAX} highlights`}
            </Text>
          </View>
        )}

        {/* Log out — solid red button (same flat tone as the Resume Import
            pill), sits directly above the delete-account danger link. */}
        <HardShadow radius={999} offset={3} style={styles.logoutShadow}>
          <Pressable
            onPress={() => {
              Alert.alert('Log out?', 'You can sign back in anytime.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Log out', style: 'destructive', onPress: () => { signOut().catch(() => {}); } },
              ]);
            }}
            style={styles.logoutBtn}
            accessibilityRole="button"
            accessibilityLabel="Log out"
          >
            <SignOut size={18} color={Brand.inkOnBrand} weight="regular" />
            <Text style={styles.logoutLabel}>Log out</Text>
          </Pressable>
        </HardShadow>

        {/* Danger zone — permanent account deletion (App Store 5.1.1(v)). */}
        <Pressable
          onPress={confirmDeleteAccount}
          disabled={deleting}
          style={styles.deleteAccountBtn}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Delete account"
        >
          <Text style={styles.deleteAccountText}>
            {deleting ? 'Deleting…' : 'Delete account'}
          </Text>
        </Pressable>

        {/* Legal — Terms + Privacy reachable anytime (App Store 5.1.1). */}
        <View style={styles.legalRow}>
          <Pressable onPress={() => setLegalDoc(TERMS_OF_USE)} hitSlop={8}>
            <Text style={styles.legalLink}>Terms of Use</Text>
          </Pressable>
          <Text style={styles.legalDot}>·</Text>
          <Pressable onPress={() => setLegalDoc(PRIVACY_POLICY)} hitSlop={8}>
            <Text style={styles.legalLink}>Privacy Policy</Text>
          </Pressable>
        </View>

        <View style={{ height: Space.xl }} />
      </ScrollView>
      ) : profile?.role === 'owner' ? (
        <View style={styles.previewWrap}>
            <OwnerProfileCard
              name={profile?.name ?? ''}
              photoUri={profile?.photo_url ?? null}
              campusName={campus?.name ?? null}
              vibe={profile?.vibe_blurb ?? ''}
              skills={skills}
              projects={ownerProjects}
              onProjectPress={(id) => router.push({ pathname: '/project-manage', params: { id } })}
            />
        </View>
      ) : (
        // WYSIWYG: render the exact DiscoveryCard owners swipe through, fed the
        // user's own card. Previously a parallel hand-rolled SeekerPreview drifted
        // from the real card (different layout, missing status badge / tiered reply
        // pill / links / 6-skill cap), so the "Preview" misrepresented the profile.
        // The reach circle is shown disabled — the seeker can't reach out to
        // themselves, but it previews the CTA owners see. Matches project-edit.tsx.
        <View style={styles.previewWrap}>
          <DiscoveryCard
            card={previewCard}
            showReachButton
            reachDisabled
            onPortfolioPress={setActivePortfolio}
            activePortfolioId={activePortfolio?.id ?? null}
          />
        </View>
      )}

      {/* ── Edit modals ────────────────────────────────────────────────── */}
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
          // Write-through so the module-level role cache (and every mounted
          // useProfileRole consumer — feed variant, routing) updates now
          // instead of after an app restart.
          if (user) setProfileRoleCache(user.id, role);
          setRoleOpen(false);
        }}
      />

      <PortfolioModal
        item={activePortfolio}
        onDismiss={() => setActivePortfolio(null)}
        onSave={handleSavePortfolio}
        onDelete={handleDeletePortfolio}
      />

      <LegalModal doc={legalDoc} onClose={() => setLegalDoc(null)} />
    </View>
  );
}

/// A single-select picker row styled to sit alongside the TextField inputs:
/// an overline label, the chosen value (or placeholder) in a bordered field
/// box, and a pencil affordance. Opens its modal on press.
function PickerField({
  label,
  value,
  placeholder,
  onPress,
}: {
  label: string;
  value: string;
  placeholder: string;
  onPress: () => void;
}) {
  const empty = !value.trim();
  return (
    <View style={styles.pickerWrap}>
      <Text style={styles.pickerLabel}>{label}</Text>
      <Pressable onPress={onPress} style={styles.pickerBox} accessibilityRole="button">
        <Text style={[styles.pickerValue, empty && styles.pickerValueEmpty]} numberOfLines={1}>
          {empty ? placeholder : value}
        </Text>
        <PencilSimpleLine size={15} color={Brand.inkMuted} weight="regular" />
      </Pressable>
    </View>
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
    // Snap to canonical chip so a known skill lands in its real category;
    // novel skills stay custom ("ADDED BY YOU").
    const skill = canonicalizeSkill(customInput);
    if (!skill || draft.includes(skill) || draft.length >= MAX_SKILLS) return;
    setDraft((d) => [...d, skill]);
    setCustomInput('');
  };

  // Dirty = the working selection diverges from the saved skills — gate dismiss
  // so a stray scrim/X tap doesn't discard the edit.
  const isDirty =
    draft.length !== selected.length || draft.some((s) => !selected.includes(s));
  const requestCancel = () => {
    if (isDirty) {
      Alert.alert('Discard changes?', "You've made edits that haven't been saved.", [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: onCancel },
      ]);
      return;
    }
    onCancel();
  };

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={requestCancel}>
      <View style={modalStyles.root}>
        <Pressable style={modalStyles.scrim} onPress={requestCancel} />
        <View style={[modalStyles.sheet, { maxHeight: '80%' }]}>
          <View style={modalStyles.sheetHeader}>
            <Text style={modalStyles.sheetTitle}>Your skills · {draft.length} / {MAX_SKILLS}</Text>
            <Pressable onPress={requestCancel} hitSlop={10}>
              <X size={20} color={Brand.inkMuted} weight="bold" />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={{ gap: Space.lg, paddingBottom: Space.lg }}
            keyboardShouldPersistTaps="handled"
          >
            {customSkills.length > 0 && (
              <View style={{ gap: 12 }}>
                <Text style={styles.sectionLabel}>ADDED BY YOU</Text>
                <View style={styles.chipRow}>
                  {customSkills.map((s) => (
                    <Chip key={s} label={s} selected onPress={() => toggle(s)} />
                  ))}
                </View>
              </View>
            )}
            {SKILL_CATEGORIES.map((cat) => (
              <View key={cat.label} style={{ gap: 12 }}>
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
            <HardShadow radius={999} offset={3}>
              <Pressable onPress={() => onSave(draft)} style={modalStyles.saveBtn}>
                <Check size={16} color={Brand.inkOnBrand} weight="bold" />
                <Text style={modalStyles.saveLabel}>Save</Text>
              </Pressable>
            </HardShadow>
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

  // Glass top bar — lilac bottom hairline; safe-area padding applied inline.
  topBar: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Brand.navBarHairline,
  },
  header: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    ...TypeScale.labelSm,
    color: Brand.inkLabel,
  },

  // Read-failure state (mirrors the feed's DeckError language).
  errorWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  errorTitle: { fontFamily: AmbitFont.display, fontSize: 24, color: Brand.inkPrimary, textAlign: 'center' },
  errorBody: { fontFamily: AmbitFont.body, fontSize: 14.5, color: Brand.inkMuted, textAlign: 'center', marginTop: 12, lineHeight: 21 },
  errorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Brand.action,
    borderWidth: 1.6,
    borderColor: Brand.actionInk,
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 999,
  },
  errorBtnText: { fontFamily: AmbitFont.body, fontSize: 15, fontWeight: '700', color: Brand.inkOnBrand },
  // Solid red log-out pill — flat danger fill, white label, lifted by shadow.
  logoutShadow: { alignSelf: 'center', marginTop: Space.xl },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minWidth: 200,
    paddingHorizontal: 32,
    paddingVertical: 13,
    borderRadius: 999,
    backgroundColor: Brand.danger,
  },
  logoutLabel: {
    fontFamily: AmbitFont.body,
    fontSize: 14,
    fontWeight: '700',
    color: Brand.inkOnBrand,
    letterSpacing: 0.2,
  },
  deleteAccountBtn: {
    alignSelf: 'center',
    marginTop: Space.md,
    paddingVertical: Space.sm,
    paddingHorizontal: Space.md,
  },
  deleteAccountText: {
    fontFamily: AmbitFont.medium,
    fontSize: 14,
    color: Brand.danger,
    letterSpacing: 0.2,
  },
  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: Space.md,
  },
  legalLink: { fontFamily: AmbitFont.body, fontSize: 12.5, color: Brand.inkMuted, textDecorationLine: 'underline' },
  legalDot: { fontFamily: AmbitFont.body, fontSize: 12.5, color: Brand.inkMuted },

  // Clearly-labeled résumé-import CTA in the edit form (ASTRA pill language).
  resumeImportShadow: { alignSelf: 'center', marginTop: Space.sm },
  resumeImportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: Brand.action,
    borderWidth: 1.6,
    borderColor: Brand.actionInk,
  },
  resumeImportLabel: {
    fontFamily: AmbitFont.body,
    fontSize: 14,
    fontWeight: '700',
    color: Brand.inkOnBrand,
    letterSpacing: 0.2,
  },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: Space.lg, paddingTop: Space.md },

  // Preview mode — the real discovery card, filling the screen like the deck.
  previewWrap: { flex: 1, paddingHorizontal: Space.lg, paddingTop: Space.sm, paddingBottom: Space.md },

  // Loading skeleton — mirrors the DiscoveryCard preview silhouette.
  skelCard: {
    flex: 1,
    backgroundColor: Brand.surface1,
    borderRadius: Radii.card,
    borderWidth: 1.5,
    borderColor: Brand.inkEdge,
    overflow: 'hidden',
  },
  skelBadge: { position: 'absolute', top: 16, right: 16 },
  skelStack: { position: 'absolute', left: 22, right: 22, bottom: 22, paddingRight: 72, gap: 16 },

  // Segmented Edit | Preview control (centered in the header band).
  // Active segment fills #9362C8 (Brand.selected) with white text.
  segment: { flexDirection: 'row', backgroundColor: Brand.surface2, borderRadius: Radii.pill, padding: 4 },
  segmentBtn: { paddingHorizontal: 20, paddingVertical: 7, borderRadius: Radii.pill },
  segmentBtnActive: { backgroundColor: Brand.selected },
  segmentText: { fontFamily: AmbitFont.semibold, fontSize: 13.5, lineHeight: 18, textAlign: 'center', includeFontPadding: false, color: Brand.inkLabel },
  segmentTextActive: { fontFamily: AmbitFont.semibold, color: Brand.inkOnBrand },

  // Centered squared avatar (royal→iris) + Change photo affordance.
  avatarBlock: { alignItems: 'center', gap: 12, paddingTop: Space.md, paddingBottom: Space.sm },
  avatarSquare: { width: 104, height: 104, borderRadius: 24, overflow: 'hidden' },
  avatarSquareImg: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  avatarSquareInitial: { fontFamily: AmbitFont.display, fontSize: 44, color: Brand.inkOnBrand },
  cameraChip: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: Brand.selected,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Brand.cardCream,
  },
  changePhoto: { fontFamily: AmbitFont.semibold, fontSize: 13.5, color: Brand.selected },

  // Inline TextField + picker stack.
  fieldStack: { gap: Space.md, marginTop: Space.md },
  pickerWrap: { gap: 8 },
  pickerLabel: {
    fontFamily: AmbitFont.semibold,
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: Brand.inkLabel,
  },
  pickerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    height: 46,
    borderRadius: Radii.sm,
    paddingHorizontal: 16,
    backgroundColor: Brand.cardCream,
    borderWidth: 1,
    borderColor: Astra.hairlinePurple,
  },
  pickerValue: { flex: 1, fontFamily: AmbitFont.body, fontSize: 14, color: Brand.inkBody },
  pickerValueEmpty: { color: Brand.inkPlaceholder },

  editSection: { marginTop: Space.lg, gap: 12 },
  editSectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  editLink: { fontFamily: AmbitFont.body, fontSize: 14, fontWeight: '600', color: Brand.actionDeep },
  projAddRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 16 },
  projAddText: { fontFamily: AmbitFont.body, fontSize: 15, fontWeight: '600', color: Brand.actionDeep },
  projEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
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
    gap: 16,
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
    gap: 8,
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
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
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
    color: Brand.actionDeep,
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
    marginTop: 8,
  },
  responseText: {
    fontFamily: AmbitFont.body,
    fontSize: 11,
    fontWeight: '600',
    color: Brand.actionDeep,
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

  section: { gap: 12 },
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
    backgroundColor: Brand.action,
    borderWidth: 1.6,
    borderColor: Brand.actionInk,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customAddBtnDisabled: { opacity: 0.4 },
  // Dashed "＋ Add" skill chip — matches the Chip atom's 40pt height.
  addChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 40,
    paddingHorizontal: 16,
    borderRadius: Radii.chip,
    borderWidth: 1.5,
    borderColor: Brand.selected,
    borderStyle: 'dashed',
  },
  addChipPlus: {
    fontFamily: AmbitFont.semibold,
    fontSize: 14,
    color: Brand.selected,
  },
  addChipLabel: {
    fontFamily: AmbitFont.semibold,
    fontSize: 13,
    color: Brand.selected,
  },

  // Portfolio grid — 3-up squared gradient tiles + a dashed add tile.
  portfolioGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  portfolioHint: {
    fontFamily: AmbitFont.body,
    fontSize: 12.5,
    color: Brand.inkMuted,
    marginTop: 10,
  },
  tile: { width: '31%', gap: 8 },
  tileImgWrap: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: Radii.md,
    overflow: 'hidden',
    backgroundColor: Brand.surface2,
  },
  tileActive: { borderWidth: 2, borderColor: Brand.selected },
  tileImg: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  tileInitial: { fontFamily: AmbitFont.display, fontSize: 30, color: Brand.inkOnBrand },
  tileTitle: { fontFamily: AmbitFont.medium, fontSize: 12.5, color: Brand.inkBody, textAlign: 'center' },
  addTile: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: Brand.selected,
    borderStyle: 'dashed',
  },
  addTileLabel: { color: Brand.selected, fontFamily: AmbitFont.semibold },
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
    borderTopLeftRadius: Radii.card,
    borderTopRightRadius: Radii.card,
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
    padding: 16,
    minHeight: 48,
  },
  inputMultiline: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  counter: {
    fontFamily: AmbitFont.body,
    fontSize: 12,
    color: Brand.inkMuted,
    textAlign: 'right',
    marginTop: -4,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: Brand.action,
    borderRadius: 999,
    borderWidth: 1.6,
    borderColor: Brand.actionInk,
  },
  saveLabel: {
    fontFamily: AmbitFont.body,
    fontSize: 14,
    fontWeight: '700',
    color: Brand.inkOnBrand,
  },

  // CampusEditModal
  campusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
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
