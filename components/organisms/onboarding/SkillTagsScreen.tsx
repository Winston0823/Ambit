import React, { useMemo, useRef, useState } from 'react';
import {
  Animated,
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  View,
} from 'react-native';
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
