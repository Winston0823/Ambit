import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackChevron } from '../../atoms';
import { OnboardingContinue } from '../../molecules';
import { useOnboarding } from '../../../context/OnboardingContext';
import { Brand, AmbitFont, Space } from '../../../constants/theme';

interface Props { onBack: () => void; onContinue: () => void; }

const AGES = Array.from({ length: 50 - 13 + 1 }, (_, i) => 13 + i);  // 13..50

/// S-005 Age Gate. Wheel-style scrollable picker.
/// Only -1 / current / +1 are visible at any time (3 items fit the viewport).
/// Middle item is huge (128pt) and full opacity; sides are smaller and faded.
/// Continue is a full-width tan pill anchored at the bottom.
export function AgeGateScreen({ onBack, onContinue }: Props) {
  const { profile, update } = useOnboarding();
  const listRef = useRef<FlatList<number>>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const itemWidth = containerWidth > 0 ? containerWidth / 3 : 0;
  const sidePadding = itemWidth;  // pad so first item can center

  // Scroll to current age once we know the width
  useEffect(() => {
    if (itemWidth === 0) return;
    const idx = AGES.indexOf(profile.age);
    if (idx >= 0) {
      listRef.current?.scrollToOffset({ offset: idx * itemWidth, animated: false });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemWidth]);

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (itemWidth === 0) return;
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / itemWidth);
    const clamped = Math.max(0, Math.min(AGES.length - 1, idx));
    const newAge = AGES[clamped];
    if (newAge !== profile.age) update('age', newAge);
  };

  const isValid = profile.age >= 18;

  return (
    <SafeAreaView style={styles.root}>
      <BackChevron onPress={onBack} />

      {/* Headline area — top-aligned, generous breathing room */}
      <View style={styles.headerWrap}>
        <Text style={styles.headline}>What is your age?</Text>
        <Text style={styles.subtitle}>
          We bring the brightest college students together
        </Text>
      </View>

      {/* Wheel — three items visible at all times */}
      <View
        style={styles.wheelWrap}
        onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
      >
        {itemWidth > 0 && (
          <FlatList
            ref={listRef}
            data={AGES}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(n) => String(n)}
            getItemLayout={(_, i) => ({ length: itemWidth, offset: itemWidth * i, index: i })}
            snapToInterval={itemWidth}
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: sidePadding }}
            onMomentumScrollEnd={onMomentumEnd}
            renderItem={({ item }) => {
              const active = item === profile.age;
              return (
                <View style={[styles.cell, { width: itemWidth }]}>
                  <Text
                    style={[
                      styles.num,
                      active ? styles.numActive : styles.numInactive,
                    ]}
                  >
                    {item}
                  </Text>
                </View>
              );
            }}
          />
        )}
      </View>

      <View style={{ flex: 1 }} />

      {/* Full-width pill button at the bottom */}
      <OnboardingContinue title="Continue" onPress={onContinue} disabled={!isValid} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.canvas },
  headerWrap: {
    paddingHorizontal: Space.lg,
    marginTop: 200,  // Figma puts the headline ~halfway down
  },
  headline: {
    fontFamily: AmbitFont.display,
    fontSize: 36,
    color: Brand.inkPrimary,
    lineHeight: 44,
  },
  subtitle: {
    fontFamily: AmbitFont.body,
    fontSize: 16,
    color: Brand.inkMuted,
    marginTop: 12,
    lineHeight: 22,
    maxWidth: 280,
  },
  wheelWrap: {
    height: 180,
    marginTop: 48,
  },
  cell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  num: {
    fontFamily: AmbitFont.display,
    textAlign: 'center',
  },
  numActive: {
    fontSize: 96,
    color: Brand.inkPrimary,
    lineHeight: 110,
  },
  numInactive: {
    fontSize: 56,
    color: Brand.inkPrimary,
    opacity: 0.25,
    lineHeight: 70,
  },
});
