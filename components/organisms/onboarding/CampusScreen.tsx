import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackChevron } from '../../atoms';
import { OnboardingContinue } from '../../molecules';
import { useOnboarding } from '../../../context/OnboardingContext';
import { CAMPUSES } from '../../../data/mock';
import { Brand, AmbitFont, Radii, Space } from '../../../constants/theme';

interface Props { onBack: () => void; onContinue: () => void; }

/// Approximate Bay Area pin positions for the stylized map.
/// Coordinates are percentage of the map area (0–100). Hand-tuned.
const PIN_COORDS: Record<string, { x: number; y: number }> = {
  stanford: { x: 38, y: 50 },
  berkeley: { x: 56, y: 28 },
  sjsu:     { x: 52, y: 70 },
  scu:      { x: 46, y: 62 },
  sfsu:     { x: 22, y: 22 },
  usf:      { x: 24, y: 16 },
  ucsc:     { x: 26, y: 86 },
};

/// S-010 Campus Selection. Stylized Bay Area illustration with pin overlays.
/// (No map API — works in Expo Go, zero quota, full control of brand aesthetic.)
export function CampusScreen({ onBack, onContinue }: Props) {
  const { profile, update } = useOnboarding();
  const isValid = profile.campusId !== null;
  const selectedCampus = CAMPUSES.find((c) => c.id === profile.campusId);

  return (
    <SafeAreaView style={styles.root}>
      <BackChevron onPress={onBack} />

      <View style={styles.header}>
        <Text style={styles.headline}>Which campus are{'\n'}you part of?</Text>
        <Text style={styles.subtitle}>Your campus shapes who you see first.</Text>
      </View>

      {/* Stylized Bay Area map */}
      <View style={styles.mapWrap}>
        <View style={styles.mapBg}>
          <View style={[styles.mapWater, { left: '0%', top: '12%' }]} />
          <View style={[styles.mapWater, { left: '8%', top: '4%', width: '34%', height: '20%' }]} />
          <View style={[styles.mapLand]} />
          {CAMPUSES.map((c) => {
            const pin = PIN_COORDS[c.id];
            if (!pin) return null;
            const isSelected = profile.campusId === c.id;
            return (
              <Pressable
                key={c.id}
                onPress={() => update('campusId', c.id)}
                style={[
                  styles.pin,
                  { left: `${pin.x}%`, top: `${pin.y}%` },
                  isSelected && styles.pinSelected,
                ]}
                hitSlop={12}
              >
                <Feather
                  name="map-pin"
                  size={isSelected ? 28 : 22}
                  color={isSelected ? Brand.accent : Brand.inkMuted}
                />
              </Pressable>
            );
          })}
        </View>
        {selectedCampus && (
          <View style={styles.selectedChip}>
            <Text style={styles.selectedText}>{selectedCampus.name}</Text>
          </View>
        )}
      </View>

      {/* Searchable list fallback (also works as a pure list selector) */}
      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {CAMPUSES.map((c) => (
          <Pressable
            key={c.id}
            onPress={() => update('campusId', c.id)}
            style={styles.row}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{c.name}</Text>
              <Text style={styles.rowSub}>{c.city}</Text>
            </View>
            {profile.campusId === c.id && (
              <Feather name="check" size={18} color={Brand.accent} />
            )}
          </Pressable>
        ))}
      </ScrollView>

      <OnboardingContinue onPress={onContinue} disabled={!isValid} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.canvas },
  header: { paddingHorizontal: Space.lg, marginTop: 12 },
  headline: {
    fontFamily: AmbitFont.display, fontSize: 28, color: Brand.inkPrimary,
  },
  subtitle: {
    fontFamily: AmbitFont.body, fontSize: 13, color: Brand.inkMuted, marginTop: 8,
  },
  mapWrap: {
    height: 220,
    marginTop: 20,
    marginHorizontal: Space.lg,
    borderRadius: Radii.lg,
    overflow: 'hidden',
    backgroundColor: Brand.surface1,
  },
  mapBg: {
    flex: 1,
    backgroundColor: '#c5e0d4',  // soft green = land
  },
  mapWater: {
    position: 'absolute',
    width: '36%',
    height: '38%',
    backgroundColor: '#a8c8e0',
    borderRadius: 16,
  },
  mapLand: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: '68%',
    height: '88%',
    backgroundColor: 'transparent',
  },
  pin: {
    position: 'absolute',
    width: 32, height: 32,
    alignItems: 'center', justifyContent: 'center',
    marginLeft: -16, marginTop: -16,
  },
  pinSelected: {
    transform: [{ scale: 1.15 }],
  },
  selectedChip: {
    position: 'absolute',
    bottom: 8,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 100,
  },
  selectedText: {
    fontFamily: AmbitFont.body, fontSize: 12, color: '#fff',
  },
  list: {
    marginTop: 16,
    paddingHorizontal: Space.lg,
    maxHeight: 280,
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Brand.borderDefault,
  },
  rowTitle: {
    fontFamily: AmbitFont.body, fontSize: 15, fontWeight: '600',
    color: Brand.inkHigh,
  },
  rowSub: {
    fontFamily: AmbitFont.body, fontSize: 13,
    color: Brand.inkMuted, marginTop: 2,
  },
});
