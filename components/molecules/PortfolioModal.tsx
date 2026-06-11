import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { HardShadow } from '../atoms';
import { ArrowUpRight, Camera, PencilSimpleLine, Trash, X } from 'phosphor-react-native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import {
  AmbitFont,
  Brand,
  Radii,
  Space,
  TypeScale,
} from '../../constants/theme';
import type { PortfolioItem } from '../../data/mock';

type Mode = 'view' | 'edit';

interface Props {
  /// The portfolio item to display, or null when no modal should render.
  item: PortfolioItem | null;
  /// Dismiss request — fires when the user taps the scrim or the bubble
  /// again. Parent clears the item to actually close the modal.
  onDismiss: () => void;
  /// When provided, the modal exposes an edit pencil and a delete button.
  /// Profile mode only — discovery passes neither.
  onSave?: (updated: PortfolioItem) => void;
  onDelete?: (id: string) => void;
}

/// Tap-to-expand portfolio detail. Two modes:
///   - 'view'  → cover, timeframe eyebrow, title, description, contribution
///               bullets, tool chips, and a link button. Pencil to edit.
///   - 'edit'  → tappable cover (change photo) + inputs for every field.
///               Delete + Save in the footer. New (empty) items open here.
export function PortfolioModal({ item, onDismiss, onSave, onDelete }: Props) {
  const { height: winH } = useWindowDimensions();
  const [mode, setMode] = useState<Mode>('view');
  const [draftTitle, setDraftTitle] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [draftImageUri, setDraftImageUri] = useState<string | null>(null);
  const [draftTimeframe, setDraftTimeframe] = useState('');
  const [draftContributions, setDraftContributions] = useState(''); // one bullet per line
  const [draftLink, setDraftLink] = useState('');
  const [toolTags, setToolTags] = useState<string[]>([]);
  const [toolDraft, setToolDraft] = useState(''); // in-progress tag text

  // Cinematic open/close choreography. The exit animation needs the
  // modal to remain mounted through its end, so we keep a local
  // `mounted` flag and defer the unmount until the exit settles.
  const [mounted, setMounted] = useState(false);
  const scrimOpacity     = useRef(new Animated.Value(0)).current;
  const sheetOpacity     = useRef(new Animated.Value(0)).current;
  const sheetScale       = useRef(new Animated.Value(0.92)).current;
  const sheetTranslateY  = useRef(new Animated.Value(36)).current;
  const contentOpacity   = useRef(new Animated.Value(0)).current;

  const easeOutExpo = Easing.bezier(0.16, 1, 0.3, 1);
  const easeInCubic = Easing.in(Easing.cubic);

  useEffect(() => {
    if (item) {
      // Mount, reset drafts, then animate in. New (empty) items open in edit.
      setMounted(true);
      setMode(item.title ? 'view' : 'edit');
      setDraftTitle(item.title);
      setDraftDescription(item.description);
      setDraftImageUri(item.imageUri);
      setDraftTimeframe(item.timeframe ?? '');
      setDraftContributions((item.contributions ?? []).join('\n'));
      setDraftLink(item.linkUrl ?? '');
      setToolTags(item.tools ?? []);
      setToolDraft('');

      scrimOpacity.setValue(0);
      sheetOpacity.setValue(0);
      sheetScale.setValue(0.92);
      sheetTranslateY.setValue(36);
      contentOpacity.setValue(0);

      Animated.parallel([
        Animated.timing(scrimOpacity, { toValue: 1, duration: 280, easing: easeOutExpo, useNativeDriver: true }),
        Animated.timing(sheetOpacity, { toValue: 1, duration: 320, delay: 60, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(sheetScale, { toValue: 1, duration: 420, delay: 60, easing: easeOutExpo, useNativeDriver: true }),
        Animated.timing(sheetTranslateY, { toValue: 0, duration: 420, delay: 60, easing: easeOutExpo, useNativeDriver: true }),
        Animated.timing(contentOpacity, { toValue: 1, duration: 280, delay: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(sheetOpacity, { toValue: 0, duration: 220, easing: easeInCubic, useNativeDriver: true }),
        Animated.timing(sheetScale, { toValue: 0.96, duration: 260, easing: easeInCubic, useNativeDriver: true }),
        Animated.timing(sheetTranslateY, { toValue: 12, duration: 260, easing: easeInCubic, useNativeDriver: true }),
        Animated.timing(scrimOpacity, { toValue: 0, duration: 240, easing: easeInCubic, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item]);

  const lastItemRef = useRef<PortfolioItem | null>(null);
  if (item) lastItemRef.current = item;
  const displayItem = item ?? lastItemRef.current;

  if (!mounted || !displayItem) return null;

  const isEditable = !!onSave;
  const canSave =
    mode === 'edit' &&
    draftTitle.trim().length > 0 &&
    draftDescription.trim().length > 0 &&
    draftTimeframe.trim().length > 0;

  // Parsed previews used in both edit (live) and view.
  const contributions =
    mode === 'edit'
      ? draftContributions.split('\n').map((s) => s.trim()).filter(Boolean)
      : displayItem.contributions ?? [];
  const tools = mode === 'edit' ? toolTags : (displayItem.tools ?? []);

  const commitTool = (raw: string) => {
    const t = raw.replace(/[,\n]/g, '').trim();
    if (t && !toolTags.some((x) => x.toLowerCase() === t.toLowerCase())) {
      setToolTags((prev) => [...prev, t]);
    }
    setToolDraft('');
  };
  const removeTool = (idx: number) => setToolTags((prev) => prev.filter((_, i) => i !== idx));

  const handleScrimPress = () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    onDismiss();
  };

  const handleEdit = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setMode('edit');
  };

  const pickImage = async () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.85,
    });
    if (result.canceled) return;
    setDraftImageUri(result.assets[0].uri);
  };

  const handleSave = () => {
    if (!canSave || !onSave) return;
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onSave({
      ...displayItem,
      title: draftTitle.trim(),
      description: draftDescription.trim(),
      imageUri: draftImageUri,
      timeframe: draftTimeframe.trim(),
      contributions,
      linkUrl: draftLink.trim() || null,
      tools,
    });
  };

  const handleDelete = () => {
    if (!onDelete) return;
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    onDelete(displayItem.id);
  };

  const coverUri = mode === 'edit' ? draftImageUri : displayItem.imageUri;
  const timeframe = mode === 'edit' ? draftTimeframe.trim() : (displayItem.timeframe ?? '');

  return (
    <Modal transparent animationType="none" visible={mounted} onRequestClose={onDismiss} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.root}>
        <Animated.View style={[styles.scrimWrap, { opacity: scrimOpacity }]}>
          <Pressable style={styles.scrim} onPress={handleScrimPress} />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            { opacity: sheetOpacity, transform: [{ translateY: sheetTranslateY }, { scale: sheetScale }] },
          ]}
        >
          {/* Cover hero — tappable to change in edit mode. */}
          <Pressable
            style={styles.imgWrap}
            disabled={mode !== 'edit'}
            onPress={pickImage}
            accessibilityRole={mode === 'edit' ? 'button' : undefined}
            accessibilityLabel={mode === 'edit' ? 'Change cover photo' : undefined}
          >
            {coverUri ? (
              <Image source={{ uri: coverUri }} style={styles.img} />
            ) : (
              <LinearGradient colors={displayItem.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.img}>
                <Text style={styles.imgInitial}>{(draftTitle[0] ?? displayItem.title[0] ?? '').toUpperCase()}</Text>
              </LinearGradient>
            )}

            {/* Change-photo affordance (edit mode). */}
            {mode === 'edit' && (
              <View style={styles.changePhoto} pointerEvents="none">
                <Camera size={15} color={Brand.inkOnBrand} weight="fill" />
                <Text style={styles.changePhotoText}>{coverUri ? 'Change photo' : 'Add photo'}</Text>
              </View>
            )}

            {/* Mode toggle controls float over the cover. */}
            {isEditable && mode === 'view' && (
              <Pressable onPress={handleEdit} style={styles.cornerBtn} hitSlop={10}>
                <PencilSimpleLine size={16} color={Brand.inkPrimary} weight="regular" />
              </Pressable>
            )}
            {mode === 'edit' && (
              <Pressable onPress={() => setMode('view')} style={styles.cornerBtn} hitSlop={10}>
                <X size={18} color={Brand.inkPrimary} weight="bold" />
              </Pressable>
            )}
          </Pressable>

          <Animated.View style={{ opacity: contentOpacity }}>
            <ScrollView
              style={{ maxHeight: winH * 0.46 }}
              contentContainerStyle={styles.body}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {mode === 'view' ? (
                <>
                  {timeframe !== '' && <Text style={styles.eyebrow}>{timeframe.toUpperCase()}</Text>}
                  <Text style={styles.title}>{displayItem.title}</Text>
                  <Text style={styles.description}>{displayItem.description}</Text>

                  {contributions.length > 0 && (
                    <View style={styles.bullets}>
                      {contributions.map((c, i) => (
                        <View key={`${c}-${i}`} style={styles.bulletRow}>
                          <View style={styles.bulletDot} />
                          <Text style={styles.bulletText}>{c}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {tools.length > 0 && (
                    <View style={styles.chipRow}>
                      {tools.map((t, i) => (
                        <View key={`${t}-${i}`} style={styles.chip}>
                          <Text style={styles.chipText}>{t}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {!!displayItem.linkUrl && (
                    <Pressable
                      onPress={() => Linking.openURL(displayItem.linkUrl as string).catch(() => {})}
                      style={({ pressed }) => [styles.linkBtn, pressed && { opacity: 0.7 }]}
                      accessibilityRole="button"
                      accessibilityLabel="Open link"
                    >
                      <Text style={styles.linkText} numberOfLines={1}>{prettyUrl(displayItem.linkUrl as string)}</Text>
                      <ArrowUpRight size={15} color={Brand.actionDeep} weight="bold" />
                    </Pressable>
                  )}
                </>
              ) : (
                <>
                  <Text style={styles.fieldLabel}>TITLE</Text>
                  <TextInput
                    value={draftTitle}
                    onChangeText={setDraftTitle}
                    placeholder="Project title"
                    placeholderTextColor={Brand.inkPlaceholder}
                    style={styles.titleInput}
                    maxLength={60}
                  />

                  <Text style={[styles.fieldLabel, styles.fieldGap]}>TIMEFRAME</Text>
                  <TextInput
                    value={draftTimeframe}
                    onChangeText={setDraftTimeframe}
                    placeholder="2025 · Spring 2025 · 3 weeks"
                    placeholderTextColor={Brand.inkPlaceholder}
                    style={styles.lineInput}
                    maxLength={40}
                  />

                  <Text style={[styles.fieldLabel, styles.fieldGap]}>DESCRIPTION</Text>
                  <TextInput
                    value={draftDescription}
                    onChangeText={setDraftDescription}
                    placeholder="What is this project and why does it matter?"
                    placeholderTextColor={Brand.inkPlaceholder}
                    multiline
                    style={styles.areaInput}
                    maxLength={400}
                  />

                  <Text style={[styles.fieldLabel, styles.fieldGap]}>WHAT YOU DID</Text>
                  <Text style={styles.hint}>One contribution per line.</Text>
                  <TextInput
                    value={draftContributions}
                    onChangeText={setDraftContributions}
                    placeholder={'Led the iOS design\nBuilt the onboarding flow\nRan 6 user tests'}
                    placeholderTextColor={Brand.inkPlaceholder}
                    multiline
                    style={styles.areaInput}
                    maxLength={600}
                  />

                  <Text style={[styles.fieldLabel, styles.fieldGap]}>TOOLS</Text>
                  <View style={styles.tagBox}>
                    {toolTags.map((t, i) => (
                      <Pressable
                        key={`${t}-${i}`}
                        onPress={() => removeTool(i)}
                        style={styles.tagChip}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${t}`}
                      >
                        <Text style={styles.tagChipText}>{t}</Text>
                        <X size={11} color={Brand.inkMuted} weight="bold" />
                      </Pressable>
                    ))}
                    <TextInput
                      value={toolDraft}
                      onChangeText={(text) => { if (/[,\n]/.test(text)) commitTool(text); else setToolDraft(text); }}
                      onSubmitEditing={() => commitTool(toolDraft)}
                      onBlur={() => { if (toolDraft.trim()) commitTool(toolDraft); }}
                      blurOnSubmit={false}
                      returnKeyType="done"
                      placeholder={toolTags.length === 0 ? 'Figma, Swift…' : 'Add'}
                      placeholderTextColor={Brand.inkPlaceholder}
                      autoCapitalize="none"
                      autoCorrect={false}
                      style={styles.tagInput}
                      maxLength={32}
                    />
                  </View>
                  <Text style={styles.hint}>Type a tool, press return to add. Tap a tag to remove.</Text>

                  <Text style={[styles.fieldLabel, styles.fieldGap]}>LINK</Text>
                  <TextInput
                    value={draftLink}
                    onChangeText={setDraftLink}
                    placeholder="https://…  (live demo, repo, case study)"
                    placeholderTextColor={Brand.inkPlaceholder}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    style={styles.lineInput}
                    maxLength={300}
                  />

                  <View style={styles.editFooter}>
                    {onDelete && (
                      <Pressable onPress={handleDelete} style={styles.deleteBtn} hitSlop={6}>
                        <Trash size={16} color={Brand.danger} weight="regular" />
                        <Text style={styles.deleteLabel}>Delete</Text>
                      </Pressable>
                    )}
                    <View style={{ flex: 1 }} />
                    <HardShadow radius={999} offset={3} style={!canSave ? { opacity: 0.45 } : undefined}>
                      <Pressable onPress={handleSave} disabled={!canSave} style={styles.saveBtn}>
                        <Text style={styles.saveLabel}>Save</Text>
                      </Pressable>
                    </HardShadow>
                  </View>
                </>
              )}
            </ScrollView>
          </Animated.View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/// Strip protocol + trailing slash for a compact link label.
function prettyUrl(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Space.lg },
  scrimWrap: { ...StyleSheet.absoluteFillObject },
  scrim: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.4)' },

  sheet: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: Brand.canvas,
    borderRadius: Radii.card,
    overflow: 'hidden',
    // Crisp ink border instead of a soft shadow (vocabulary: no soft shadows;
    // a HardShadow wrapper is impractical here since the sheet animates).
    borderWidth: 1.5,
    borderColor: Brand.inkEdge,
  },

  imgWrap: { width: '100%', height: 220, position: 'relative' },
  img: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  imgInitial: { fontFamily: AmbitFont.display, fontSize: 100, color: 'rgba(255, 255, 255, 0.88)' },
  cornerBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: Radii.full,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  changePhoto: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radii.full,
    backgroundColor: 'rgba(20, 20, 20, 0.55)',
  },
  changePhotoText: { fontFamily: AmbitFont.body, fontSize: 12.5, fontWeight: '600', color: Brand.inkOnBrand },

  body: { padding: Space.lg, gap: 12 },

  // ── View mode ─────────────────────────────────────────────────────────────
  eyebrow: {
    fontFamily: AmbitFont.body,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.6,
    color: Brand.inkMuted,
  },
  title: { fontFamily: AmbitFont.display, fontSize: 26, color: Brand.inkPrimary, lineHeight: 32 },
  description: { ...TypeScale.body, fontSize: 15, color: Brand.inkBody, lineHeight: 22 },
  bullets: { gap: 8, marginTop: 2 },
  bulletRow: { flexDirection: 'row', gap: 12 },
  bulletDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: Brand.accent,
    marginTop: 8,
  },
  bulletText: { flex: 1, fontFamily: AmbitFont.body, fontSize: 14.5, color: Brand.inkBody, lineHeight: 21 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: Brand.surface1 },
  chipText: { fontFamily: AmbitFont.body, fontSize: 12, fontWeight: '600', color: Brand.inkBody },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: Radii.md,
    backgroundColor: Brand.surface1,
    maxWidth: '100%',
  },
  linkText: { fontFamily: AmbitFont.body, fontSize: 13.5, fontWeight: '700', color: Brand.actionDeep, flexShrink: 1 },

  // ── Edit mode ───────────────────────────────────────────────────────────
  fieldLabel: { ...TypeScale.labelSm, color: Brand.inkLabel },
  fieldGap: { marginTop: 8 },
  hint: { fontFamily: AmbitFont.body, fontSize: 12, color: Brand.inkMuted, marginTop: -4 },
  titleInput: {
    fontFamily: AmbitFont.display,
    fontSize: 22,
    color: Brand.inkPrimary,
    paddingHorizontal: 0,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Brand.borderDefault,
  },
  lineInput: {
    fontFamily: AmbitFont.body,
    fontSize: 15,
    color: Brand.inkBody,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: Brand.surface1,
    borderRadius: Radii.md,
  },
  areaInput: {
    fontFamily: AmbitFont.body,
    fontSize: 15,
    color: Brand.inkBody,
    lineHeight: 22,
    minHeight: 80,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: Brand.surface1,
    borderRadius: Radii.md,
    textAlignVertical: 'top',
  },
  // Tag input — chips + an inline field; return/comma commits a tag.
  tagBox: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: Brand.surface1,
    borderRadius: Radii.md,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Brand.canvas,
    borderWidth: 1,
    borderColor: Brand.borderDefault,
  },
  tagChipText: { fontFamily: AmbitFont.body, fontSize: 12.5, fontWeight: '600', color: Brand.inkBody },
  tagInput: {
    flexGrow: 1,
    minWidth: 80,
    fontFamily: AmbitFont.body,
    fontSize: 15,
    color: Brand.inkBody,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  editFooter: { marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 4 },
  deleteLabel: { fontFamily: AmbitFont.body, fontSize: 14, fontWeight: '600', color: Brand.danger },
  saveBtn: { paddingHorizontal: 20, paddingVertical: 12, backgroundColor: Brand.action, borderRadius: 999, borderWidth: 1.6, borderColor: Brand.actionInk },
  saveLabel: { fontFamily: AmbitFont.body, fontSize: 14, fontWeight: '700', color: Brand.actionInk },
});
