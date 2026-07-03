import React, { useRef } from 'react';
import { Animated, Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { DiscoveryCardData } from '../../data/mock';
import { HardShadow } from '../atoms';
import { AmbitFont, Astra, Brand, Radii, Space, TypeScale } from '../../constants/theme';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = 152;
const CARD_H = 208;
const GAP = 16;
const SNAP = CARD_W + GAP;
/// Side padding so the focused card sits dead-center (SIDE + CARD_W/2 = SCREEN/2).
const SIDE = (SCREEN_W - CARD_W) / 2;

interface Props {
  cards: DiscoveryCardData[];
  onPress: (card: DiscoveryCardData) => void;
}

/// "Recently saved" hero carousel. A center-snapping rail where the focused
/// card scales up and sits upright while neighbours shrink, dip, fade, and
/// tilt outward — and each card's photo parallax-shifts inside its frame for
/// depth. All native-driver (scrollX) so it stays buttery in Expo Go.
export function SavedCarousel({ cards, onPress }: Props) {
  const scrollX = useRef(new Animated.Value(0)).current;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>RECENTLY SAVED</Text>
      <Animated.ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={SNAP}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: SIDE }}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: true },
        )}
      >
        {cards.map((card, i) => {
          const center = i * SNAP;
          const range = [center - SNAP, center, center + SNAP];
          const scale = scrollX.interpolate({ inputRange: range, outputRange: [0.86, 1, 0.86], extrapolate: 'clamp' });
          const rotate = scrollX.interpolate({ inputRange: range, outputRange: ['6deg', '0deg', '-6deg'], extrapolate: 'clamp' });
          const translateY = scrollX.interpolate({ inputRange: range, outputRange: [16, 0, 16], extrapolate: 'clamp' });
          const opacity = scrollX.interpolate({ inputRange: range, outputRange: [0.5, 1, 0.5], extrapolate: 'clamp' });
          const photoShift = scrollX.interpolate({ inputRange: range, outputRange: [20, 0, -20], extrapolate: 'clamp' });

          const isSeeker = card.kind === 'seeker';
          const title = isSeeker ? card.name : card.title;

          return (
            <Animated.View
              key={card.id}
              style={[styles.outer, { opacity, transform: [{ translateY }, { scale }, { rotate }] }]}
            >
              <HardShadow radius={Radii.card} offset={4} style={styles.shadowFill}>
              <Pressable onPress={() => onPress(card)} style={styles.card} accessibilityLabel={`Open ${title}`}>
                {isSeeker && card.photoUri ? (
                  <Animated.Image
                    source={{ uri: card.photoUri }}
                    style={[styles.photo, { transform: [{ translateX: photoShift }, { scale: 1.12 }] }]}
                  />
                ) : (
                  <LinearGradient
                    colors={[Astra.royal, Astra.iris]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                )}
                <LinearGradient colors={['transparent', 'rgba(12,0,34,0.88)']} style={styles.scrim} />
                <View style={styles.meta}>
                  <Text style={styles.eyebrow}>{isSeeker ? 'SEEKER' : 'PROJECT'}</Text>
                  <Text style={styles.title} numberOfLines={2}>{title}</Text>
                </View>
              </Pressable>
              </HardShadow>
            </Animated.View>
          );
        })}
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: Space.lg },
  label: {
    ...TypeScale.labelSm,
    color: Brand.inkLabel,
    paddingHorizontal: Space.lg,
    marginBottom: 12,
  },
  outer: { width: CARD_W, height: CARD_H, marginRight: GAP },
  shadowFill: { flex: 1 },
  card: {
    flex: 1,
    borderRadius: Radii.card,
    overflow: 'hidden',
    backgroundColor: Astra.royal,
  },
  photo: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '62%' },
  meta: { position: 'absolute', left: 12, right: 12, bottom: 12 },
  eyebrow: {
    fontFamily: AmbitFont.semibold,
    fontSize: 9,
    letterSpacing: 1.2,
    color: 'rgba(255,255,255,0.72)',
    marginBottom: 3,
  },
  title: { fontFamily: AmbitFont.display, fontSize: 17, color: Brand.inkOnBrand, lineHeight: 20 },
});
