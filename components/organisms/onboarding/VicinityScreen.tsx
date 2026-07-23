import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckCircle, Laptop, MapPin } from 'phosphor-react-native';
import { BackChevron, HardShadow } from '../../atoms';
import { OnboardingContinue } from '../../molecules';
import { useOnboarding } from '../../../context/OnboardingContext';
import { Brand, Astra, AmbitFont, Radii, Space } from '../../../constants/theme';

interface Props { onBack: () => void; onContinue: () => void; }

/// S-010 Vicinity — opt-in to in-person collaboration nearby. Two mutually
/// exclusive option cards; the answer drives whether nearby matches surface.
/// Reversible later from the profile menu.
export function VicinityScreen({ onBack, onContinue }: Props) {
  const { profile, update } = useOnboarding();
  const isValid = profile.openToNearby !== null;

  const options = [
    {
      value: true,
      Icon: MapPin,
      title: 'In person nearby',
      sub: 'Open to meeting up and working together in person',
    },
    {
      value: false,
      Icon: Laptop,
      title: 'Remote only',
      sub: 'Collaborate online, wherever you are',
    },
  ] as const;

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.watermark} pointerEvents="none">
        <MapPin size={360} color={Brand.actionDeep} weight="duotone" />
      </View>

      <BackChevron onPress={onBack} />

      <View style={styles.header}>
        <Text style={styles.kicker}>Vicinity</Text>
        <Text style={styles.headline}>Work in person?</Text>
        <Text style={styles.subtitle}>
          You can change this anytime from your profile.
        </Text>
      </View>

      <View style={styles.list}>
        {options.map(({ value, Icon, title, sub }) => {
          const selected = profile.openToNearby === value;
          return (
            <HardShadow key={title} radius={Radii.md} offset={4} style={styles.rowShadow}>
              <Pressable
                onPress={() => update('openToNearby', value)}
                style={[styles.row, selected && styles.rowSelected]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <View style={styles.rowIcon}>
                  <Icon
                    size={20}
                    color={selected ? Brand.inkOnBrand : Brand.actionDeep}
                    weight={selected ? 'fill' : 'regular'}
                  />
                </View>

                <View style={styles.rowText}>
                  <Text style={[styles.rowName, selected && styles.rowNameSelected]}>
                    {title}
                  </Text>
                  <Text style={[styles.rowSub, selected && styles.rowSubSelected]}>
                    {sub}
                  </Text>
                </View>

                {selected && (
                  <CheckCircle size={22} color={Brand.inkOnBrand} weight="fill" />
                )}
              </Pressable>
            </HardShadow>
          );
        })}
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
  list: {
    paddingHorizontal: Space.lg,
    gap: 12,
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
  rowSub: {
    fontFamily: AmbitFont.body,
    fontSize: 12,
    color: Brand.inkMuted,
    marginTop: 2,
  },
  rowSubSelected: { color: Astra.lilac },
});
