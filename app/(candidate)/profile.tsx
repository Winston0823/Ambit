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
  Check,
  MapPin,
  PencilSimpleLine,
  SignOut,
  X,
} from 'phosphor-react-native';
import { Chip } from '../../components/atoms';
import {
  AddPortfolioBubble,
  PortfolioBubble,
  PortfolioModal,
  SpeechBubble,
} from '../../components/molecules';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { readLocalFileAsArrayBuffer } from '../../lib/messaging';
import { CAMPUSES, SKILL_CATEGORIES } from '../../data/mock';
import type { PortfolioItem } from '../../data/mock';
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
  role: 'owner' | 'seeker' | 'both' | null;
  campus_id: string | null;
  photo_url: string | null;
}

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

  // Portfolio is local state for now.
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);

  // Edit modal state
  const [textEdit, setTextEdit] = useState<TextEditState | null>(null);
  const [skillsOpen, setSkillsOpen] = useState(false);
  const [campusOpen, setCampusOpen] = useState(false);
  const [activePortfolio, setActivePortfolio] = useState<PortfolioItem | null>(null);

  // Initial fetch
  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, name, vibe_blurb, skills, role, campus_id, photo_url')
        .eq('id', user.id)
        .maybeSingle();
      if (cancelled) return;
      setProfile(data as ProfileRow | null);
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
  /// updates feel snappy and the network call is fire-and-forget.
  const updateField = async (field: keyof ProfileRow, value: ProfileRow[keyof ProfileRow]) => {
    if (!user) return;
    setProfile((p) => (p ? { ...p, [field]: value } : p));
    await supabase.from('profiles').update({ [field]: value }).eq('id', user.id);
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

  // ── Portfolio CRUD (local-only for v1) ────────────────────────────────────

  const handleSavePortfolio = (updated: PortfolioItem) => {
    setPortfolio((prev) => {
      const exists = prev.some((p) => p.id === updated.id);
      return exists ? prev.map((p) => (p.id === updated.id ? updated : p)) : [...prev, updated];
    });
    setActivePortfolio(null);
  };
  const handleDeletePortfolio = (id: string) => {
    setPortfolio((prev) => prev.filter((p) => p.id !== id));
    setActivePortfolio(null);
  };
  const addNewPortfolio = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    setActivePortfolio({
      id: `new-${Date.now()}`,
      imageUri: null,
      title: '',
      description: '',
      gradient: PORTFOLIO_GRADIENTS[portfolio.length % PORTFOLIO_GRADIENTS.length],
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

  return (
    <View style={styles.root}>
      {/* Header — minimal: an eyebrow label so the user knows they're in
          edit mode, plus a sign-out button in the corner. */}
      <View style={[styles.header, { paddingTop: Space.sm }]}>
        <Text style={styles.eyebrow}>YOUR CARD</Text>
        <Pressable
          onPress={() => { signOut().catch(() => {}); }}
          style={styles.signOutBtn}
          hitSlop={10}
          accessibilityLabel="Sign out"
        >
          <SignOut size={18} color={Brand.inkMuted} weight="regular" />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          {/* Top row: avatar (with camera badge) + name (with pencil) +
              campus (with pencil) */}
          <View style={styles.topRow}>
            <Pressable onPress={pickPhoto} hitSlop={4} style={styles.avatarPressable}>
              <View style={styles.avatar}>
                {profile?.photo_url ? (
                  <Image source={{ uri: profile.photo_url }} style={styles.avatarImg} />
                ) : (
                  <Text style={styles.avatarInitial}>{initial}</Text>
                )}
              </View>
              <View style={styles.cameraBadge}>
                <Camera size={12} color={Brand.inkPrimary} weight="regular" />
              </View>
            </Pressable>

            <View style={styles.nameCol}>
              <Pressable
                onPress={() =>
                  setTextEdit({
                    field: 'name',
                    title: 'Your name',
                    value: profile?.name ?? '',
                    placeholder: 'Alex Chen',
                    multiline: false,
                  })
                }
                style={styles.fieldPress}
                hitSlop={4}
              >
                <Text style={styles.name} numberOfLines={1}>
                  {profile?.name || 'Tap to add your name'}
                </Text>
                <PencilSimpleLine size={13} color={Brand.inkMuted} weight="regular" />
              </Pressable>

              <Pressable
                onPress={() => setCampusOpen(true)}
                style={styles.fieldPress}
                hitSlop={4}
              >
                <MapPin size={12} color={Brand.inkMuted} weight="fill" />
                <Text style={styles.campusText} numberOfLines={1}>
                  {campus?.name ?? 'Tap to set campus'}
                </Text>
                <PencilSimpleLine size={11} color={Brand.inkMuted} weight="regular" />
              </Pressable>
            </View>
          </View>

          {/* Vibe blurb — speech bubble with pencil at the right edge */}
          <Pressable
            onPress={() =>
              setTextEdit({
                field: 'vibe_blurb',
                title: 'Your vibe',
                value: profile?.vibe_blurb ?? '',
                placeholder: 'Two sentences about how you like to work.',
                multiline: true,
              })
            }
          >
            <SpeechBubble color={Brand.seekerSurface} tailAnchor="top-left" tailOffset={20}>
              <View style={styles.vibeRow}>
                <Text style={styles.vibe}>
                  {profile?.vibe_blurb || 'Tap to add your vibe.'}
                </Text>
                <PencilSimpleLine size={14} color={Brand.seekerInk} weight="regular" />
              </View>
            </SpeechBubble>
          </Pressable>

          {/* Skills */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>SKILLS</Text>
            <View style={styles.chipRow}>
              {skills.map((s) => (
                <Chip key={s} label={s} selected={false} />
              ))}
              <Pressable onPress={() => setSkillsOpen(true)} style={styles.addChip}>
                <Text style={styles.addChipPlus}>+</Text>
                <Text style={styles.addChipLabel}>
                  {skills.length === 0 ? 'Add skills' : 'Edit'}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Portfolio */}
          <View style={styles.section}>
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
        </View>

        <View style={{ height: Space.xl }} />
      </ScrollView>

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

      <PortfolioModal
        item={activePortfolio}
        onDismiss={() => setActivePortfolio(null)}
        onSave={handleSavePortfolio}
        onDelete={handleDeletePortfolio}
      />
    </View>
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

  useEffect(() => {
    if (visible) setDraft(selected);
  }, [visible, selected]);

  const toggle = (skill: string) => {
    setDraft((d) => (d.includes(skill) ? d.filter((s) => s !== skill) : [...d, skill]));
  };

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onCancel}>
      <View style={modalStyles.root}>
        <Pressable style={modalStyles.scrim} onPress={onCancel} />
        <View style={[modalStyles.sheet, { maxHeight: '80%' }]}>
          <View style={modalStyles.sheetHeader}>
            <Text style={modalStyles.sheetTitle}>Your skills</Text>
            <Pressable onPress={onCancel} hitSlop={10}>
              <X size={20} color={Brand.inkMuted} weight="bold" />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ gap: Space.lg, paddingBottom: Space.lg }}>
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
