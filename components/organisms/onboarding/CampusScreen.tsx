import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { CheckCircle, MapPin } from 'phosphor-react-native';
import { BackChevron } from '../../atoms';
import { OnboardingContinue } from '../../molecules';
import { useOnboarding } from '../../../context/OnboardingContext';
import { CAMPUSES } from '../../../data/mock';
import { Brand, AmbitFont, Radii, Space } from '../../../constants/theme';

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

  return (
    <SafeAreaView style={styles.root}>
      <BackChevron onPress={onBack} />

      <View style={styles.header}>
        <Text style={styles.headline}>Where do you go?</Text>
        <Text style={styles.subtitle}>
          Your campus shapes who you see first.
        </Text>
      </View>

      {/* Scroll area + fade overlays. marginBottom lives on the wrap so
          the bottom fade sits at the scroll area's true bottom edge, not
          below the entire CTA reserve zone. */}
      <View style={[styles.scrollWrap, { marginBottom: insets.bottom + 130 }]}>
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        >
          {CAMPUSES.map((c) => {
            const selected = profile.campusId === c.id;
            return (
              <Pressable
                key={c.id}
                onPress={() => update('campusId', c.id)}
                style={[styles.row, selected && styles.rowSelected]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <View style={styles.rowIcon}>
                  <MapPin
                    size={20}
                    color={selected ? Brand.seekerInk : Brand.inkMuted}
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
                  <CheckCircle size={22} color={Brand.seekerInk} weight="fill" />
                )}
              </Pressable>
            );
          })}
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
  header: {
    paddingHorizontal: Space.lg,
    marginTop: 40,
    marginBottom: Space.lg,
  },
  headline: {
    fontFamily: AmbitFont.display,
    fontSize: 30,
    color: Brand.inkPrimary,
    lineHeight: 36,
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
    gap: 10,
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: Brand.surface2,
    borderRadius: Radii.md,
  },
  rowSelected: {
    backgroundColor: Brand.seekerSurface,
  },
  rowIcon: {
    width: 28,
    alignItems: 'center',
  },
  rowText: { flex: 1 },
  rowName: {
    fontFamily: AmbitFont.body,
    fontSize: 15,
    fontWeight: '600',
    color: Brand.inkHigh,
  },
  rowNameSelected: { color: Brand.seekerInk },
  rowCity: {
    fontFamily: AmbitFont.body,
    fontSize: 12,
    color: Brand.inkMuted,
    marginTop: 2,
  },
  rowCitySelected: { color: Brand.accent },
});
