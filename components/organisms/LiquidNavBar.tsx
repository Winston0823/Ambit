import React, { useEffect, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  LayoutChangeEvent,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
  withTiming,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Palette } from '../../constants/theme';

export type NavTabKey = 'discovery' | 'chat' | 'projects' | 'profile';

export interface NavTab {
  key: NavTabKey;
  label: string;
  icon: keyof typeof Feather.glyphMap;
}

export const DEFAULT_TABS: NavTab[] = [
  { key: 'discovery', label: 'Discovery', icon: 'compass' },
  { key: 'chat', label: 'Chat', icon: 'message-circle' },
  { key: 'projects', label: 'Projects', icon: 'folder' },
  { key: 'profile', label: 'Profile', icon: 'user' },
];

interface LiquidNavBarProps {
  tabs?: NavTab[];
  activeKey: NavTabKey;
  onChange: (key: NavTabKey) => void;
}

const BAR_HORIZONTAL_MARGIN = 16;
const BAR_INNER_PADDING = 6;
const BAR_HEIGHT = 64;
const SPRING = { damping: 18, stiffness: 220, mass: 0.9 };

export function LiquidNavBar({
  tabs = DEFAULT_TABS,
  activeKey,
  onChange,
}: LiquidNavBarProps) {
  const insets = useSafeAreaInsets();
  const [barWidth, setBarWidth] = useState(0);

  const activeIndex = Math.max(
    0,
    tabs.findIndex((t) => t.key === activeKey),
  );

  const tabWidth = barWidth
    ? (barWidth - BAR_INNER_PADDING * 2) / tabs.length
    : 0;

  const translateX = useSharedValue(0);
  const stretch = useSharedValue(1);

  useEffect(() => {
    if (!tabWidth) return;
    const target = BAR_INNER_PADDING + activeIndex * tabWidth;
    translateX.value = withSpring(target, SPRING);
    stretch.value = withSequence(
      withTiming(1.18, { duration: 140 }),
      withSpring(1, SPRING),
    );
  }, [activeIndex, tabWidth, translateX, stretch]);

  const pillStyle = useAnimatedStyle(() => {
    const squashY = interpolate(
      stretch.value,
      [1, 1.18],
      [1, 0.92],
      Extrapolation.CLAMP,
    );
    return {
      transform: [
        { translateX: translateX.value },
        { scaleX: stretch.value },
        { scaleY: squashY },
      ],
    };
  });

  const handlePress = (key: NavTabKey) => {
    if (key === activeKey) return;
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
    onChange(key);
  };

  const onLayout = (e: LayoutChangeEvent) => {
    setBarWidth(e.nativeEvent.layout.width);
  };

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.wrapper,
        { paddingBottom: Math.max(insets.bottom, 12) },
      ]}
    >
      <View style={styles.shadowFrame} onLayout={onLayout}>
        <BlurView
          intensity={Platform.OS === 'ios' ? 70 : 40}
          tint="light"
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.creamTint} pointerEvents="none" />
        <View style={styles.hairline} pointerEvents="none" />

        {tabWidth > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.pill,
              {
                width: tabWidth,
                left: 0,
                top: BAR_INNER_PADDING,
                bottom: BAR_INNER_PADDING,
              },
              pillStyle,
            ]}
          >
            <View style={styles.pillFill} />
            <View style={styles.pillHighlight} pointerEvents="none" />
          </Animated.View>
        )}

        <View style={styles.row}>
          {tabs.map((tab) => {
            const active = tab.key === activeKey;
            return (
              <Pressable
                key={tab.key}
                onPress={() => handlePress(tab.key)}
                style={styles.tab}
                hitSlop={6}
                accessibilityRole="tab"
                accessibilityLabel={tab.label}
                accessibilityState={{ selected: active }}
              >
                <Feather
                  name={tab.icon}
                  size={22}
                  color={active ? Palette.white : Palette.warmGray}
                  style={{ marginBottom: 2 }}
                />
                <Text
                  style={[
                    styles.label,
                    { color: active ? Palette.white : Palette.warmGray },
                  ]}
                  numberOfLines={1}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: BAR_HORIZONTAL_MARGIN,
    alignItems: 'stretch',
  },
  shadowFrame: {
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.30)',
    shadowColor: Palette.glassShadow,
    shadowOpacity: 1,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 14,
    borderWidth: Platform.OS === 'android' ? 1 : 0,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  creamTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Palette.glassCreamTint,
  },
  hairline: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 1,
    backgroundColor: Palette.glassHairline,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: BAR_INNER_PADDING,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  pill: {
    position: 'absolute',
    borderRadius: 999,
    overflow: 'hidden',
  },
  pillFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Palette.pillInk,
  },
  pillHighlight: {
    position: 'absolute',
    top: 1,
    left: 10,
    right: 10,
    height: '38%',
    borderRadius: 999,
    backgroundColor: Palette.pillHighlight,
  },
});
