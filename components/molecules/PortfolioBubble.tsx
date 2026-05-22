import React, { useRef } from 'react';
import {
  Animated,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Plus } from 'phosphor-react-native';
import * as Haptics from 'expo-haptics';
import {
  AmbitFont,
  Brand,
  Radii,
  TypeScale,
} from '../../constants/theme';
import type { PortfolioItem } from '../../data/mock';

const BUBBLE_SIZE = 72;

interface PortfolioBubbleProps {
  item: PortfolioItem;
  onPress: () => void;
  /// When true, the bubble is "active" (its modal is open). Adds a faint
  /// brand-tan ring so the user keeps spatial context while the modal sits
  /// in the foreground.
  active?: boolean;
}

/// A single portfolio entry: 72pt circular image (or gradient placeholder)
/// with the title centered below. Pressable with a subtle scale pulse,
/// matching the Chip/Button motion idiom.
export function PortfolioBubble({ item, onPress, active }: PortfolioBubbleProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const press = () => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.94, duration: 70, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 4, tension: 220, useNativeDriver: true }),
    ]).start();
    onPress();
  };

  return (
    <Animated.View style={[styles.wrap, { transform: [{ scale }] }]}>
      <Pressable onPress={press} style={styles.thumbWrap} hitSlop={6}>
        <View style={[styles.thumb, active && styles.thumbActive]}>
          {item.imageUri ? (
            <Image source={{ uri: item.imageUri }} style={styles.thumbImg} />
          ) : (
            <LinearGradient
              colors={item.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.thumbImg}
            >
              <Text style={styles.thumbInitial}>
                {(item.title[0] ?? '').toUpperCase()}
              </Text>
            </LinearGradient>
          )}
        </View>
        <Text style={styles.title} numberOfLines={2}>
          {item.title}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

/// "+ Add" bubble for the profile screen. Dashed accent border, plus glyph,
/// "Add" label. Reuses the same dimensions and motion as PortfolioBubble so
/// the row stays visually rhythmic.
interface AddPortfolioBubbleProps {
  onPress: () => void;
  label?: string;
}

export function AddPortfolioBubble({ onPress, label = 'Add' }: AddPortfolioBubbleProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const press = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.94, duration: 70, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 4, tension: 220, useNativeDriver: true }),
    ]).start();
    onPress();
  };

  return (
    <Animated.View style={[styles.wrap, { transform: [{ scale }] }]}>
      <Pressable onPress={press} style={styles.thumbWrap} hitSlop={6}>
        <View style={[styles.thumb, styles.addThumb]}>
          <Plus size={28} color={Brand.accent} weight="bold" />
        </View>
        <Text style={[styles.title, styles.addTitle]} numberOfLines={1}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
  },
  thumbWrap: {
    alignItems: 'center',
    gap: 8,
    width: 88, // slightly wider than the bubble so title can wrap to 2 lines
  },
  thumb: {
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    borderRadius: Radii.full,
    backgroundColor: Brand.surface1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbActive: {
    borderWidth: 2,
    borderColor: Brand.accent,
  },
  thumbImg: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbInitial: {
    fontFamily: AmbitFont.display,
    fontSize: 28,
    color: Brand.inkOnBrand,
  },
  title: {
    ...TypeScale.helper,
    fontWeight: '600',
    color: Brand.inkBody,
    textAlign: 'center',
  },

  // "+ Add" variant
  addThumb: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: Brand.accent,
    borderStyle: 'dashed',
  },
  addTitle: {
    color: Brand.accent,
    fontWeight: '700',
  },
});
