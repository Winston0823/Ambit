import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
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

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList<number>);

/// Wheel-picker tuning constants.
///
/// All digits render at ACTIVE_FONT (96pt) with the same line box. The
/// rendered glyph and visual scale are controlled per-item by interpolating
/// the live scroll position — that's what gives the wheel its drum-roll
/// feel instead of popping discretely at momentum-end.
const ACTIVE_FONT      = 96;
const INACTIVE_SCALE   = 56 / ACTIVE_FONT;   // neighbor digits render at 56pt visual
const EDGE_SCALE       = 0.32;                // pre-/post-neighbor — almost faded out
const WHEEL_HEIGHT     = 140;

/// Cap-height compensation. Zodiak Bold's glyph sits above its line-box
/// center by some amount of pt — the exact value depends on the font's
/// ascender/cap-height metrics, which we don't have to hand. Instead of
/// guessing a constant, we make translateY *proportional* to scale via
/// Animated.multiply: every item gets pushed down by (CAP_RATIO * scale).
/// That way, even if the absolute value is slightly off, the relative
/// offset between active and inactive scales together — the active digit
/// can't drift away from the neighbors. CAP_RATIO is the fraction of
/// fontSize the glyph sits above center (~0.12 for display serifs at this
/// size; tunable if the eye still reads anything as elevated).
const CAP_RATIO = 0.12;

/// S-005 Age Gate. Continuous wheel-style picker.
///
/// Only -1 / current / +1 fit the viewport at a time. As the user scrolls,
/// every visible digit's scale and opacity interpolate smoothly off the live
/// scroll offset (native-driver, 60fps). Each cell renders an identically-
/// sized 96pt line box; scale shrinks the neighbors around their own visual
/// center, so all three digits share a common vertical midline.
export function AgeGateScreen({ onBack, onContinue }: Props) {
  const { profile, update } = useOnboarding();
  const listRef = useRef<FlatList<number>>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const [containerWidth, setContainerWidth] = useState(0);
  const itemWidth = containerWidth > 0 ? containerWidth / 3 : 0;
  const sidePadding = itemWidth;

  useEffect(() => {
    if (itemWidth === 0) return;
    const idx = AGES.indexOf(profile.age);
    if (idx >= 0) {
      const offset = idx * itemWidth;
      listRef.current?.scrollToOffset({ offset, animated: false });
      scrollX.setValue(offset);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemWidth]);

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (itemWidth === 0) return;
    const idx = Math.round(e.nativeEvent.contentOffset.x / itemWidth);
    const clamped = Math.max(0, Math.min(AGES.length - 1, idx));
    const next = AGES[clamped];
    if (next !== profile.age) update('age', next);
  };

  const isValid = profile.age >= 18;

  return (
    <SafeAreaView style={styles.root}>
      <BackChevron onPress={onBack} />

      <View style={styles.headerWrap}>
        <Text style={styles.headline}>What is your age?</Text>
        <Text style={styles.subtitle}>
          We bring the brightest college students together
        </Text>
      </View>

      <View
        style={styles.wheelWrap}
        onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
      >
        {itemWidth > 0 && (
          <AnimatedFlatList
            ref={listRef as React.Ref<FlatList<number>>}
            data={AGES}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(n) => String(n)}
            getItemLayout={(_, i) => ({
              length: itemWidth,
              offset: itemWidth * i,
              index: i,
            })}
            snapToInterval={itemWidth}
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: sidePadding }}
            scrollEventThrottle={16}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { x: scrollX } } }],
              { useNativeDriver: true }
            )}
            onMomentumScrollEnd={onMomentumEnd}
            renderItem={({ item, index }) => {
              const itemCenter = index * itemWidth;
              const inputRange = [
                itemCenter - 2 * itemWidth,
                itemCenter - itemWidth,
                itemCenter,
                itemCenter + itemWidth,
                itemCenter + 2 * itemWidth,
              ];
              const scale = scrollX.interpolate({
                inputRange,
                outputRange: [EDGE_SCALE, INACTIVE_SCALE, 1, INACTIVE_SCALE, EDGE_SCALE],
                extrapolate: 'clamp',
              });
              const opacity = scrollX.interpolate({
                inputRange,
                outputRange: [0, 0.25, 1, 0.25, 0],
                extrapolate: 'clamp',
              });
              // translateY scales with the visual size. RN composes
              // right-to-left, so [{ translateY }, { scale }] applies scale
              // first (glyph moves to -K_actual * s), then translateY
              // (CAP_RATIO * ACTIVE_FONT * s = ~K_actual * s, cancelling
              // the offset). Whatever the actual cap-height ratio is, the
              // active and inactive glyphs end up at the same fraction-of-
              // line-box position, so they line up with each other.
              const translateY = Animated.multiply(scale, CAP_RATIO * ACTIVE_FONT);
              // Render each digit as its own Text so iOS's bounding-box
              // computation can't leak round-glyph overshoot (e.g. "0") into
              // the vertical positioning of the whole string. Each glyph
              // sits in its own line-box and centers independently.
              const digits = String(item).split('');
              return (
                <View style={[styles.cell, { width: itemWidth }]}>
                  <Animated.View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      opacity,
                      transform: [{ translateY }, { scale }],
                    }}
                  >
                    {digits.map((d, i) => (
                      <Text key={i} style={styles.num}>{d}</Text>
                    ))}
                  </Animated.View>
                </View>
              );
            }}
          />
        )}
      </View>

      <View style={{ flex: 1 }} />

      <OnboardingContinue title="Continue" onPress={onContinue} disabled={!isValid} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.canvas },
  headerWrap: {
    paddingHorizontal: Space.lg,
    marginTop: 200,
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
    height: WHEEL_HEIGHT,
    marginTop: 48,
  },
  cell: {
    height: WHEEL_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  num: {
    fontFamily: AmbitFont.display,
    fontSize: ACTIVE_FONT,
    lineHeight: ACTIVE_FONT,
    color: Brand.inkPrimary,
    textAlign: 'center',
    includeFontPadding: false,
  },
});
