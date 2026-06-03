import React, { useEffect, useRef } from 'react';
import { Animated, Platform, Pressable, StyleSheet, View } from 'react-native';
import { CheckCircle } from 'phosphor-react-native';
import type { IconProps } from 'phosphor-react-native';
import * as Haptics from 'expo-haptics';
import { Brand, Radii, AmbitFont } from '../../constants/theme';

type PhosphorIcon = React.ComponentType<IconProps>;

interface Props {
  title: string;
  subtitle: string;
  selected?: boolean;
  onPress?: () => void;
  /// Optional leading icon — gives each choice a visual anchor so the card
  /// reads as a "choice" rather than a paragraph.
  icon?: PhosphorIcon;
}

/// Role-selection option card. Warm, tactile, horizontal:
///   [ icon ]  Title              [ ✓ ]
///             subtitle
///
/// - Unselected: cream surface + soft hairline (stays in the warm family
///   instead of the old cold grey block).
/// - Selected:   seekerSurface fill, seekerInk title, accent subtitle, with
///   a checkmark fading/scaling into the trailing slot.
///
/// Two animation channels:
///   - `scale` (native): a brief press pulse so a tap reads as tactile.
///   - `sel` (0→1, non-native): cross-fades fill + text colors and the
///     checkmark when `selected` flips, instead of an instant swap.
export function OptionCard({ title, subtitle, selected = false, onPress, icon: Icon }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const sel = useRef(new Animated.Value(selected ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(sel, {
      toValue: selected ? 1 : 0,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [selected, sel]);

  const press = () => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.97, duration: 80, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 4, tension: 200, useNativeDriver: true }),
    ]).start();
    onPress?.();
  };

  const bg = sel.interpolate({
    inputRange: [0, 1],
    outputRange: [Brand.cardCream, Brand.seekerSurface],
  });
  const borderColor = sel.interpolate({
    inputRange: [0, 1],
    outputRange: [Brand.borderSoft, Brand.primary],
  });
  const titleColor = sel.interpolate({
    inputRange: [0, 1],
    outputRange: [Brand.inkHigh, Brand.seekerInk],
  });
  const subColor = sel.interpolate({
    inputRange: [0, 1],
    outputRange: [Brand.inkMuted, Brand.accent],
  });
  const checkScale = sel.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable onPress={press}>
        <Animated.View style={[styles.card, { backgroundColor: bg, borderColor }]}>
          {Icon && (
            <View style={styles.iconWrap}>
              <Icon size={26} color={selected ? Brand.seekerInk : Brand.accent} weight="duotone" />
            </View>
          )}

          <View style={styles.textCol}>
            <Animated.Text style={[styles.title, { color: titleColor }]}>{title}</Animated.Text>
            <Animated.Text style={[styles.subtitle, { color: subColor }]}>{subtitle}</Animated.Text>
          </View>

          <Animated.View
            pointerEvents="none"
            style={{ opacity: sel, transform: [{ scale: checkScale }] }}
          >
            <CheckCircle size={24} color={Brand.accent} weight="fill" />
          </Animated.View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 88,
    borderRadius: Radii.lg,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconWrap: {
    width: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: { flex: 1 },
  title: {
    fontFamily: AmbitFont.body,
    fontSize: 16,
    fontWeight: '600',
  },
  subtitle: {
    fontFamily: AmbitFont.body,
    fontSize: 13,
    marginTop: 4,
    lineHeight: 19,
  },
});
