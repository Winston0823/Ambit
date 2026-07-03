import React, { useRef } from 'react';
import {
  ActivityIndicator,
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
import { HardShadow } from './HardShadow';

type Variant = 'primary' | 'secondary' | 'ghost';

interface Props {
  title: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  trailingArrow?: boolean;
  /// Stretch to fill the parent width (form CTAs).
  fullWidth?: boolean;
  /// Show a spinner instead of the label; also blocks press.
  loading?: boolean;
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
  fullWidth = false,
  loading = false,
  style,
}: Props) {
  const tones = TONES[variant];
  const scale = useRef(new Animated.Value(1)).current;
  const blocked = disabled || loading;

  const press = () => {
    if (blocked) return;
    haptics.tap();
    onPress();
  };

  const pressIn = () =>
    Animated.spring(scale, { toValue: Motion.press.scale, ...Motion.press.in, useNativeDriver: true }).start();

  const pressOut = () =>
    Animated.spring(scale, { toValue: 1, ...Motion.press.out, useNativeDriver: true }).start();

  const isPrimary = variant === 'primary';
  const inner = (
    <Pressable
      onPress={press}
      onPressIn={pressIn}
      onPressOut={pressOut}
      disabled={blocked}
      style={({ pressed }) => [
        styles.base,
        tones.container,
        fullWidth && styles.fullWidth,
        { opacity: pressed ? 0.92 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={tones.label.color as string} />
      ) : (
        <>
          <Text style={[styles.label, tones.label]}>{title.toUpperCase()}</Text>
          {trailingArrow && (
            <Image
              source={require('../../assets/icons/ArrowSwirl.png')}
              style={styles.arrow}
              resizeMode="contain"
            />
          )}
        </>
      )}
    </Pressable>
  );

  return (
    <Animated.View
      style={[{ transform: [{ scale }] }, fullWidth && styles.fullWidth, disabled && { opacity: 0.45 }]}
    >
      {isPrimary ? <HardShadow radius={Radii.sm} offset={6}>{inner}</HardShadow> : inner}
    </Animated.View>
  );
}

const TONES: Record<Variant, { container: ViewStyle; label: TextStyle }> = {
  primary: {
    // Royal fill, white label. Soft elevation via the <HardShadow> wrapper.
    container: {
      backgroundColor: Brand.action,
    },
    label: { color: Brand.inkOnBrand },
  },
  secondary: {
    // Glass: translucent white + purple hairline, ink label.
    container: {
      backgroundColor: 'rgba(255,255,255,0.6)',
      borderWidth: 1,
      borderColor: 'rgba(111,77,162,0.28)',
    },
    label: { color: Brand.inkPrimary },
  },
  ghost: {
    container: { backgroundColor: 'transparent' },
    label: { color: Brand.action },
  },
};

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: Radii.sm,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  label: {
    fontFamily: AmbitFont.semibold,
    fontSize: 14,
    letterSpacing: 1.2,
  },
  arrow: {
    width: 52,
    height: 18,
    marginLeft: 8,
  },
  fullWidth: {
    alignSelf: 'stretch',
    width: '100%',
  },
});
