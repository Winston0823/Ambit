import React, { useMemo, useRef, useState } from 'react';
import {
  Animated,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Plus, Sparkle } from 'phosphor-react-native';
import { BackChevron, Chip } from '../../atoms';
import { OnboardingContinue, ResumeImportSheet } from '../../molecules';
import { useOnboarding } from '../../../context/OnboardingContext';
import { useAuth } from '../../../context/AuthContext';
import { canonicalizeSkill, normalizeResumeSkills, type ParsedResume } from '../../../lib/resume';
import { SKILL_CATEGORIES } from '../../../data/mock';
import { Brand, AmbitFont, Space } from '../../../constants/theme';

/// Canvas-to-transparent endpoints for the fade-out gradients. Using
/// explicit rgba(255,255,255,0) instead of 'transparent' avoids iOS's
/// transparent-to-color interpolation defaulting through black (which
/// would tint the fade gray).
const CANVAS_OPAQUE = Brand.canvas;
const CANVAS_CLEAR  = 'rgba(255, 255, 255, 0)';
const FADE_HEIGHT   = 32;

interface Props { onBack: () => void; onContinue: () => void; }

const MIN_SELECTED = 2;
const MAX_SELECTED = 8;

/// S-008 Skill Tag Selector.
export function SkillTagsScreen({ onBack, onContinue }: Props) {
  const { profile, update } = useOnboarding();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const selected = profile.skills;
  const [customInput, setCustomInput] = useState('');
  const [importOpen, setImportOpen] = useState(false);

  // Résumé import fills the draft non-destructively: merge skills (existing
  // first), and fill name/blurb only if the user hasn't typed them yet.
  const handleResumeParsed = (r: ParsedResume) => {
    update('skills', normalizeResumeSkills([...profile.skills, ...(r.skills ?? [])]).slice(0, MAX_SELECTED));
    if (!profile.name.trim() && r.name?.trim()) update('name', r.name.trim());
    if (!profile.vibeBlurb.trim() && r.headline?.trim()) update('vibeBlurb', r.headline.trim());
  };

  const allPreset = new Set(SKILL_CATEGORIES.flatMap((c) => c.tags));
  const customSkills = selected.filter((s) => !allPreset.has(s));

  const toggle = (tag: string) => {
    if (selected.includes(tag)) {
      update('skills', selected.filter((t) => t !== tag));
    } else if (selected.length < MAX_SELECTED) {
      update('skills', [...selected, tag]);
    }
  };

  const addCustom = () => {
    // Snap a typed skill to its canonical chip ("typescript" → "TypeScript")
    // so a known skill lands in its real category section; novel skills stay
    // custom (rendered under "ADDED BY YOU").
    const skill = canonicalizeSkill(customInput);
    if (!skill || selected.includes(skill) || selected.length >= MAX_SELECTED) return;
    update('skills', [...selected, skill]);
    setCustomInput('');
  };

  const isValid = selected.length >= MIN_SELECTED;

  // Scroll-conditional fades. Top fade ramps in over the first FADE_HEIGHT
  // pt of scroll; bottom fade ramps out over the last FADE_HEIGHT pt
  // before the content end. When content fits the viewport (no scroll
  // possible), both opacities are 0 — exactly the Apple Music / Hinge
  // behavior of "only show the fade when there's something to fade off".
  const scrollY = useRef(new Animated.Value(0)).current;
  const [contentH, setContentH] = useState(0);
  const [layoutH, setLayoutH] = useState(0);

  const topOpacity = useMemo(
    () => scrollY.interpolate({
      inputRange: [0, FADE_HEIGHT],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    }),
    [scrollY],
  );

  const bottomOpacity = useMemo(() => {
    const maxScroll = Math.max(0, contentH - layoutH);
    // inputRange must be strictly ascending — the +0.001 keeps it valid
    // even when maxScroll === 0 (content fits viewport).
    return scrollY.interpolate({
      inputRange: [maxScroll - FADE_HEIGHT, maxScroll + 0.001],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    });
  }, [scrollY, contentH, layoutH]);

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.watermark} pointerEvents="none">
        <Sparkle size={360} color={Brand.actionDeep} weight="duotone" />
      </View>

      <BackChevron onPress={onBack} />

      <Text style={styles.kicker}>Skills</Text>
      <View style={styles.titleRow}>
        <Text style={styles.headline}>What are you{'\n'}good at?</Text>
        <View style={styles.counter}>
          <Text style={styles.counterText}>{selected.length} / {MAX_SELECTED}</Text>
        </View>
      </View>

      <Pressable onPress={() => setImportOpen(true)} style={styles.importBtn} accessibilityLabel="Import from résumé">
        <Sparkle size={15} color={Brand.actionDeep} weight="fill" />
        <Text style={styles.importBtnText}>Import a résumé to autofill</Text>
      </Pressable>

      {/* Scroll area + fade overlays. Wrap so the gradients can absolute-
          position over the ScrollView's visible edges. marginBottom lives
          on the wrap so the fade-bottom sits exactly at the scroll area's
          bottom edge, not below it. */}
      <View style={[styles.scrollWrap, { marginBottom: insets.bottom + 130 }]}>
        <Animated.ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          scrollEventThrottle={16}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true },
          )}
          onContentSizeChange={(_w: number, h: number) => setContentH(h)}
          onLayout={(e: NativeSyntheticEvent<{ layout: { height: number } }>) =>
            setLayoutH(e.nativeEvent.layout.height)
          }
        >
          {customSkills.length > 0 && (
            <View style={styles.category}>
              <Text style={styles.categoryLabel}>ADDED BY YOU</Text>
              <View style={styles.chipRow}>
                {customSkills.map((s) => (
                  <Chip key={s} label={s} selected onPress={() => toggle(s)} />
                ))}
              </View>
            </View>
          )}
          {SKILL_CATEGORIES.map((cat) => (
            <View key={cat.label} style={styles.category}>
              <Text style={styles.categoryLabel}>{cat.label}</Text>
              <View style={styles.chipRow}>
                {cat.tags.map((tag) => (
                  <Chip
                    key={tag}
                    label={tag}
                    selected={selected.includes(tag)}
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
              style={[
                styles.customAddBtn,
                (!customInput.trim() || selected.length >= MAX_SELECTED) && styles.customAddBtnDisabled,
              ]}
            >
              <Plus size={16} color="white" weight="bold" />
            </Pressable>
          </View>
        </Animated.ScrollView>

        <Animated.View
          style={[styles.fadeTop, { opacity: topOpacity }]}
          pointerEvents="none"
        >
          <LinearGradient
            colors={[CANVAS_OPAQUE, CANVAS_CLEAR]}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        <Animated.View
          style={[styles.fadeBottom, { opacity: bottomOpacity }]}
          pointerEvents="none"
        >
          <LinearGradient
            colors={[CANVAS_CLEAR, CANVAS_OPAQUE]}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </View>

      <OnboardingContinue onPress={onContinue} disabled={!isValid} />

      <ResumeImportSheet
        visible={importOpen}
        onClose={() => setImportOpen(false)}
        userId={user?.id ?? ''}
        onParsed={handleResumeParsed}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.canvas },
  importBtn: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 8,
    marginTop: 16, marginHorizontal: Space.lg,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999,
    backgroundColor: Brand.seekerSurface,
  },
  importBtnText: { fontFamily: AmbitFont.bold, fontSize: 13.5, color: Brand.actionDeep },
  watermark: {
    position: 'absolute',
    top: 110,
    right: -90,
    opacity: 0.08,
  },
  kicker: {
    fontFamily: AmbitFont.semibold,
    fontSize: 12,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: Brand.inkLabel,
    paddingHorizontal: Space.lg,
    marginTop: 40,
    marginBottom: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: Space.lg,
    marginTop: 8,
  },
  headline: {
    fontFamily: AmbitFont.display,
    fontSize: 34,
    color: Brand.inkPrimary,
    lineHeight: 40,
    flex: 1,
  },
  counter: {
    backgroundColor: Brand.action,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 12,
  },
  counterText: {
    fontFamily: AmbitFont.bold,
    fontSize: 11,
    color: Brand.inkOnBrand,
  },
  scrollWrap: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: Space.lg,
    paddingTop: Space.xl,
  },
  fadeTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: FADE_HEIGHT,
  },
  fadeBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: FADE_HEIGHT,
  },
  category: { marginBottom: Space.xxl },
  categoryLabel: {
    fontFamily: AmbitFont.body,
    fontSize: 11,
    letterSpacing: 1.2,
    color: Brand.inkLabel,
    marginBottom: 16,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Space.xxl,
  },
  customInput: {
    flex: 1,
    height: 40,
    borderRadius: 999,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  customAddBtnDisabled: { opacity: 0.4 },
});
