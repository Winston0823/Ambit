import React from 'react';
import {
  Image,
  ImageSourcePropType,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Brand, TypeScale } from '../../constants/theme';

export type NavTabKey = 'discovery' | 'chat' | 'projects' | 'profile';

export interface NavTab {
  key: NavTabKey;
  label: string;
  icon: ImageSourcePropType;
}

/// PNG icon assets. Metro auto-picks @1x/@2x/@3x from the same require().
export const DEFAULT_TABS: NavTab[] = [
  { key: 'discovery', label: 'Discovery', icon: require('../../assets/icons/nav/DiscoveryIcon.png') },
  { key: 'chat',      label: 'Chat',      icon: require('../../assets/icons/nav/ChatIcon.png') },
  { key: 'projects',  label: 'Projects',  icon: require('../../assets/icons/nav/ProjectsIcon.png') },
  { key: 'profile',   label: 'Profile',   icon: require('../../assets/icons/nav/ProfileIcon.png') },
];

/// Per-icon optical height. Compensates for different source PNG content
/// densities so every icon FEELS the same size to the eye, even though the
/// underlying images have different internal padding. Tuned by visual diff
/// against the Figma reference. Replace these once all four PNGs are
/// re-exported from a uniform Figma canvas (e.g., 40x40 with consistent
/// inner padding).
const ICON_OPTICAL_HEIGHT: Record<NavTabKey, number> = {
  discovery: 28,   // wide source, content fills well
  chat:      28,   // wide source, content fills well
  projects:  32,   // compact source, scales up to match
  profile:   32,   // narrow source content, scales up to match
};

interface Props {
  tabs?: NavTab[];
  activeKey: NavTabKey;
  onChange: (key: NavTabKey) => void;
}

/// Anchored bottom tab bar. Full width, rounded top corners only, solid dark fill,
/// PNG icons, active state via opacity. Mirrors the SwiftUI LiquidNavBar 1:1.
export function LiquidNavBar({ tabs = DEFAULT_TABS, activeKey, onChange }: Props) {
  const insets = useSafeAreaInsets();

  const handleTap = (key: NavTabKey) => {
    if (key === activeKey) return;
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    onChange(key);
  };

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      {tabs.map((tab) => {
        const active = tab.key === activeKey;
        return (
          <Pressable
            key={tab.key}
            onPress={() => handleTap(tab.key)}
            style={styles.tab}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: active }}
          >
            <View
              style={[
                styles.iconBox,
                { height: ICON_OPTICAL_HEIGHT[tab.key], opacity: active ? 1 : 0.62 },
              ]}
            >
              <Image
                source={tab.icon}
                style={styles.icon}
                resizeMode="contain"
              />
            </View>
            <Text
              style={[styles.label, { opacity: active ? 1 : 0.62 }]}
              numberOfLines={1}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: Brand.navBarBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
    paddingHorizontal: 8,
    // Subtle top highlight via overlay border
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.06)',
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -6 },
    elevation: 18,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBox: {
    // Width is uniform (visual column); height varies per tab below for
    // optical balance, because the source PNGs have different internal
    // padding / content densities. iOS HIG calls this "optical sizing".
    // Root fix is to standardize Figma export canvases — this compensates
    // until then.
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    // Image fills its iconBox; resizeMode='contain' on the Image element
    // keeps aspect ratio without cropping.
    height: '100%',
    width: '100%',
  },
  label: {
    ...TypeScale.nav,
    color: Brand.inkOnBrand,
    marginTop: 6,
  },
});
