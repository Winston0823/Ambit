import React, { useEffect, useRef, useState } from 'react';
import { FlatList, NativeScrollEvent, NativeSyntheticEvent, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackChevron } from '../../atoms';
import { OnboardingContinue } from '../../molecules';
import { useOnboarding } from '../../../context/OnboardingContext';
import { Brand, AmbitFont, Space } from '../../../constants/theme';

interface Props { onBack: () => void; onContinue: () => void; }

const ITEM_WIDTH = 96;        // each age cell width
const AGES = Array.from({ length: 50 - 13 + 1 }, (_, i) => 13 + i);  // 13..50

/// S-005 Age Gate. Scrollable horizontal age wheel with center-snap.
/// Whichever age is centered = selected. Side ages are dimmed.
export function AgeGateScreen({ onBack, onContinue }: Props) {
  const { profile, update } = useOnboarding();
  const listRef = useRef<FlatList<number>>(null);
  const [windowWidth, setWindowWidth] = useState(402);

  const sidePadding = (windowWidth - ITEM_WIDTH) / 2;

  // Scroll to the current age on mount
  useEffect(() => {
    if (windowWidth === 402) return; // wait for layout
    const idx = AGES.indexOf(profile.age);
    if (idx >= 0) {
      listRef.current?.scrollToOffset({ offset: idx * ITEM_WIDTH, animated: false });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowWidth]);

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / ITEM_WIDTH);
    const newAge = AGES[Math.max(0, Math.min(AGES.length - 1, idx))];
    if (newAge !== profile.age) update('age', newAge);
  };

  const isValid = profile.age >= 18;

  return (
    <SafeAreaView style={styles.root}>
      <BackChevron onPress={onBack} />

      <View
        style={styles.content}
        onLayout={(e) => setWindowWidth(e.nativeEvent.layout.width)}
      >
        <Text style={styles.headline}>What is your age?</Text>
        <Text style={styles.subtitle}>We bring the brightest college students together</Text>

        <View style={styles.wheelWrap}>
          <FlatList
            ref={listRef}
            data={AGES}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(n) => String(n)}
            getItemLayout={(_, i) => ({ length: ITEM_WIDTH, offset: ITEM_WIDTH * i, index: i })}
            snapToInterval={ITEM_WIDTH}
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: sidePadding }}
            onMomentumScrollEnd={onMomentumEnd}
            renderItem={({ item }) => (
              <View style={styles.cell}>
                <Text
                  style={[
                    styles.num,
                    item === profile.age ? styles.numActive : styles.numInactive,
                  ]}
                >
                  {item}
                </Text>
              </View>
            )}
          />
        </View>
      </View>

      <OnboardingContinue onPress={onContinue} disabled={!isValid} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.canvas },
  content: {
    flex: 1,
    paddingHorizontal: Space.lg,
    justifyContent: 'center',
  },
  headline: {
    fontFamily: AmbitFont.display, fontSize: 36, color: Brand.inkPrimary,
  },
  subtitle: {
    fontFamily: AmbitFont.body, fontSize: 16, color: Brand.inkMuted,
    marginTop: 16, maxWidth: 260,
  },
  wheelWrap: {
    marginTop: 60,
    marginHorizontal: -Space.lg,   // expand to full width
    height: 160,
  },
  cell: {
    width: ITEM_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  num: { fontFamily: AmbitFont.display },
  numActive: {
    fontSize: 128,
    color: Brand.inkPrimary,
  },
  numInactive: {
    fontSize: 96,
    color: Brand.inkPrimary,
    opacity: 0.3,
  },
});
