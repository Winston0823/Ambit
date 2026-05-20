import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BackChevron, Chip } from '../../atoms';
import { OnboardingContinue } from '../../molecules';
import { useOnboarding } from '../../../context/OnboardingContext';
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
  const insets = useSafeAreaInsets();
  const selected = profile.skills;

  const toggle = (tag: string) => {
    if (selected.includes(tag)) {
      update('skills', selected.filter((t) => t !== tag));
    } else if (selected.length < MAX_SELECTED) {
      update('skills', [...selected, tag]);
    }
  };

  const isValid = selected.length >= MIN_SELECTED;

  return (
    <SafeAreaView style={styles.root}>
      <BackChevron onPress={onBack} />

      <View style={styles.titleRow}>
        <Text style={styles.headline}>What are you{'\n'}good at?</Text>
        <View style={styles.counter}>
          <Text style={styles.counterText}>{selected.length} / {MAX_SELECTED}</Text>
        </View>
      </View>

      {/* Scroll area + fade overlays. Wrap so the gradients can absolute-
          position over the ScrollView's visible edges. marginBottom lives
          on the wrap so the fade-bottom sits exactly at the scroll area's
          bottom edge, not below it. */}
      <View style={[styles.scrollWrap, { marginBottom: insets.bottom + 130 }]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
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
        </ScrollView>

        <LinearGradient
          colors={[CANVAS_OPAQUE, CANVAS_CLEAR]}
          style={styles.fadeTop}
          pointerEvents="none"
        />
        <LinearGradient
          colors={[CANVAS_CLEAR, CANVAS_OPAQUE]}
          style={styles.fadeBottom}
          pointerEvents="none"
        />
      </View>

      <OnboardingContinue onPress={onContinue} disabled={!isValid} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.canvas },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: Space.lg,
    marginTop: 40,
  },
  headline: {
    fontFamily: AmbitFont.display,
    fontSize: 30,
    color: Brand.inkPrimary,
    flex: 1,
  },
  counter: {
    backgroundColor: Brand.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    // Sits with the first line of the headline (30px display font, default
    // line-height ≈ 36 — center the pill optically against that line).
    marginTop: 10,
  },
  counterText: {
    fontFamily: AmbitFont.body,
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
});
