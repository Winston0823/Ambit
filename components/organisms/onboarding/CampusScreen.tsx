import React, { useMemo, useRef, useState } from 'react';
import {
  Animated,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { CheckCircle, MapPin } from 'phosphor-react-native';
import { BackChevron, HardShadow } from '../../atoms';
import { OnboardingContinue } from '../../molecules';
import { useOnboarding } from '../../../context/OnboardingContext';
import { CAMPUSES } from '../../../data/mock';
import { Brand, Astra, AmbitFont, Radii, Space } from '../../../constants/theme';

/// Canvas-to-transparent endpoints — explicit rgba(255,255,255,0) so iOS
/// doesn't interpolate 'transparent' through black and tint the fade gray.
const CANVAS_OPAQUE = Brand.canvas;
const CANVAS_CLEAR  = 'rgba(255, 255, 255, 0)';
const FADE_HEIGHT   = 32;

interface Props { onBack: () => void; onContinue: () => void; }

/// S-010 Campus Selection — LA edition.
///
/// Geographic scope pivoted from Bay Area to LA (USC + UCLA anchors). With
/// the smaller set of schools, a stylized map adds visual noise without
/// payoff — a clean card list reads faster and respects the warm-tan/cream
/// design language.
export function CampusScreen({ onBack, onContinue }: Props) {
  const { profile, update } = useOnboarding();
  const insets = useSafeAreaInsets();
  const isValid = profile.campusId !== null;

  // Scroll-conditional fade — same Animated.Value + interpolate pattern as
  // SkillTagsScreen. Top fade only when scrolled away from the start,
  // bottom fade only when there's more content below the viewport.
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
    return scrollY.interpolate({
      inputRange: [maxScroll - FADE_HEIGHT, maxScroll + 0.001],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    });
  }, [scrollY, contentH, layoutH]);

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.watermark} pointerEvents="none">
        <MapPin size={360} color={Brand.actionDeep} weight="duotone" />
      </View>

      <BackChevron onPress={onBack} />

      <View style={styles.header}>
        <Text style={styles.kicker}>Campus</Text>
        <Text style={styles.headline}>Where do you go?</Text>
        <Text style={styles.subtitle}>
          Your campus shapes who you see first.
        </Text>
      </View>

      {/* Scroll area + fade overlays. marginBottom lives on the wrap so
          the bottom fade sits at the scroll area's true bottom edge, not
          below the entire CTA reserve zone. */}
      <View style={[styles.scrollWrap, { marginBottom: insets.bottom + 130 }]}>
        <Animated.ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
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
          {CAMPUSES.map((c) => {
            const selected = profile.campusId === c.id;
            return (
              <HardShadow key={c.id} radius={Radii.md} offset={4} style={styles.rowShadow}>
              <Pressable
                onPress={() => update('campusId', c.id)}
                style={[styles.row, selected && styles.rowSelected]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <View style={styles.rowIcon}>
                  <MapPin
                    size={20}
                    color={selected ? Brand.inkOnBrand : Brand.actionDeep}
                    weight={selected ? 'fill' : 'regular'}
                  />
                </View>

                <View style={styles.rowText}>
                  <Text style={[styles.rowName, selected && styles.rowNameSelected]}>
                    {c.name}
                  </Text>
                  <Text style={[styles.rowCity, selected && styles.rowCitySelected]}>
                    {c.city}
                  </Text>
                </View>

                {selected && (
                  <CheckCircle size={22} color={Brand.inkOnBrand} weight="fill" />
                )}
              </Pressable>
              </HardShadow>
            );
          })}
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
  watermark: {
    position: 'absolute',
    top: 110,
    right: -90,
    opacity: 0.08,
  },
  header: {
    paddingHorizontal: Space.lg,
    marginTop: 40,
    marginBottom: Space.lg,
  },
  kicker: {
    fontFamily: AmbitFont.semibold,
    fontSize: 12,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: Brand.inkLabel,
    marginBottom: 12,
  },
  headline: {
    fontFamily: AmbitFont.display,
    fontSize: 34,
    color: Brand.inkPrimary,
    lineHeight: 40,
  },
  subtitle: {
    fontFamily: AmbitFont.body,
    fontSize: 13,
    color: Brand.inkMuted,
    marginTop: 12,
  },
  scrollWrap: {
    flex: 1,
  },
  list: {
    paddingHorizontal: Space.lg,
    gap: 12,
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
  rowShadow: {
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: Brand.cardCream,
    borderRadius: Radii.md,
    borderWidth: 1.5,
    borderColor: 'rgba(111,77,162,0.28)',
  },
  rowSelected: {
    backgroundColor: Brand.selected,
    borderColor: Brand.selected,
  },
  rowIcon: {
    width: 28,
    alignItems: 'center',
  },
  rowText: { flex: 1 },
  rowName: {
    fontFamily: AmbitFont.semibold,
    fontSize: 15,
    color: Brand.inkHigh,
  },
  rowNameSelected: { color: Brand.inkOnBrand },
  rowCity: {
    fontFamily: AmbitFont.body,
    fontSize: 12,
    color: Brand.inkMuted,
    marginTop: 2,
  },
  rowCitySelected: { color: Astra.lilac },
});
