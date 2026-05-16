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

/// S-010 Campus Selection. Search input + list of Bay Area campuses.
export function CampusScreen({ onBack, onContinue }: Props) {
  const { profile, update } = useOnboarding();
  const isValid = profile.campusId !== null;

  return (
    <SafeAreaView style={styles.root}>
      <BackChevron onPress={onBack} />
      <View style={{ height: 16 }} />

      <Text style={styles.headline}>Which campus are{'\n'}you part of?</Text>
      <Text style={styles.subtitle}>Your campus shapes who you see first.</Text>

      <View style={styles.searchBar}>
        <Feather name="search" size={16} color={Brand.inkMuted} />
        <Text style={styles.searchPlaceholder}>Search for your campus</Text>
      </View>

      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {CAMPUSES.map((c) => (
          <Pressable
            key={c.id}
            onPress={() => update('campusId', c.id)}
            style={[
              styles.row,
              profile.campusId === c.id && styles.rowSelected,
            ]}
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
  headline: {
    fontFamily: AmbitFont.display, fontSize: 30, color: Brand.inkPrimary,
    paddingHorizontal: Space.lg,
  },
  subtitle: {
    fontFamily: AmbitFont.body, fontSize: 13, color: Brand.inkMuted,
    marginTop: 12, paddingHorizontal: Space.lg,
  },
  searchBar: {
    marginTop: 24, marginHorizontal: Space.lg,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    height: 46, borderRadius: Radii.md,
    paddingHorizontal: 14,
    backgroundColor: Brand.surface1,
    borderWidth: 1.5, borderColor: Brand.borderDefault,
  },
  searchPlaceholder: {
    fontFamily: AmbitFont.body, fontSize: 14, color: Brand.inkPlaceholder,
  },
  list: {
    flex: 1, marginTop: 16,
    paddingHorizontal: Space.lg,
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Brand.borderDefault,
  },
  rowSelected: {},
  rowTitle: {
    fontFamily: AmbitFont.body, fontSize: 15, fontWeight: '600',
    color: Brand.inkHigh,
  },
  rowSub: {
    fontFamily: AmbitFont.body, fontSize: 13,
    color: Brand.inkMuted, marginTop: 2,
  },
});
