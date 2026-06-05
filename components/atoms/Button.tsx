import React, { useRef } from 'react';
import {
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextStyle,
  ViewStyle,
} from 'react-native';
import { Brand, Radii, AmbitFont } from '../../constants/theme';
import { Motion } from '../../constants/motion';
import { haptics } from '../../lib/haptics';

type Variant = 'primary' | 'secondary' | 'ghost';

interface Props {
  title: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  trailingArrow?: boolean;
  style?: ViewStyle;
}

/// Primary CTA. Warm-tan fill, white label, 12pt radius.
/// `trailingArrow` renders the hand-drawn swirl arrow from Figma.
///
/// Adds two interaction signals over a plain Pressable:
///   - press-in compression (scale 0.96) via native-driver spring
///   - light haptic on confirmed press
/// Both fire only when the button is enabled.
export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  trailingArrow = false,
  style,
}: Props) {
  const tones = TONES[variant];
  const scale = useRef(new Animated.Value(1)).current;

  const press = () => {
    if (disabled) return;
    haptics.tap();
    onPress();
  };

  const pressIn = () =>
    Animated.spring(scale, { toValue: Motion.press.scale, ...Motion.press.in, useNativeDriver: true }).start();

  const pressOut = () =>
    Animated.spring(scale, { toValue: 1, ...Motion.press.out, useNativeDriver: true }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={press}
        onPressIn={pressIn}
        onPressOut={pressOut}
        disabled={disabled}
        style={({ pressed }) => [
          styles.base,
          tones.container,
          { opacity: disabled ? 0.45 : pressed ? 0.92 : 1 },
          style,
        ]}
      >
        <Text style={[styles.label, tones.label]}>{title}</Text>
        {trailingArrow && (
          <Image
            source={require('../../assets/icons/ArrowSwirl.png')}
            style={styles.arrow}
            resizeMode="contain"
          />
        )}
      </Pressable>
    </Animated.View>
  );
}

const TONES: Record<Variant, { container: ViewStyle; label: TextStyle }> = {
  primary: {
    container: { backgroundColor: Brand.primary },
    label: { color: Brand.inkOnBrand },
  },
  secondary: {
    container: {
      backgroundColor: Brand.surface1,
      borderWidth: 1.5,
      borderColor: Brand.borderDefault,
    },
    label: { color: Brand.inkPrimary },
  },
  ghost: {
    container: { backgroundColor: 'transparent' },
    label: { color: Brand.accent },
  },
};

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: Radii.md,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  label: {
    fontFamily: AmbitFont.body,
    fontSize: 17,
  },
  arrow: {
    width: 52,
    height: 18,
    marginLeft: 6,
  },
});
