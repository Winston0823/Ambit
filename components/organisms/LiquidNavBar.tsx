import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  Sailboat,
  ChatCircle,
  ChatCircleDots,
  Stack,
  UserCircle,
  UserCircleDashed,
  IconProps,
} from 'phosphor-react-native';
import { Brand } from '../../constants/theme';

export type NavTabKey = 'discovery' | 'chat' | 'projects' | 'profile';

type PhosphorIcon = React.ComponentType<IconProps>;

interface NavTab {
  key: NavTabKey;
  label: string;
  /// Outline icon shown when the tab is inactive.
  inactiveIcon: PhosphorIcon;
  /// Filled icon shown when the tab is active. Many Phosphor icons have a
  /// distinct "active" variant (e.g. ChatCircleDots) that adds a state cue —
  /// use those where they exist.
  activeIcon: PhosphorIcon;
}

/// Phosphor icon picks per tab. Sailboat carries the proximity/explore
/// metaphor better than Compass for Ambit's "discover students near you"
/// thesis. ChatCircleDots has an unread-state hint baked in. Profile uses
/// a dashed circle when inactive (reads as "not yet entered") and resolves
/// to the solid UserCircle once selected.
const TABS: NavTab[] = [
  { key: 'discovery', label: 'Discovery', inactiveIcon: Sailboat,         activeIcon: Sailboat    },
  { key: 'chat',      label: 'Chat',      inactiveIcon: ChatCircle,       activeIcon: ChatCircleDots },
  { key: 'projects',  label: 'Projects',  inactiveIcon: Stack,            activeIcon: Stack       },
  { key: 'profile',   label: 'Profile',   inactiveIcon: UserCircleDashed, activeIcon: UserCircle  },
];

interface Props {
  activeKey: NavTabKey;
  onChange: (key: NavTabKey) => void;
}

const ACTIVE_COLOR   = Brand.inkOnBrand;                  // white icon on dark nav
const INACTIVE_COLOR = 'rgba(255, 255, 255, 0.55)';

/// Anchored bottom tab bar. Active tab is marked by an icon swap from
/// outline → fill weight (or a distinct fill variant). Icon-only — no
/// labels, so the bar stays quiet and the cue is purely visual.
export function LiquidNavBar({ activeKey, onChange }: Props) {
  const insets = useSafeAreaInsets();

  const handleTap = (key: NavTabKey) => {
    if (key === activeKey) return;
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    onChange(key);
  };

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {TABS.map((tab) => {
        const active = tab.key === activeKey;
        const Icon = active ? tab.activeIcon : tab.inactiveIcon;

        return (
          <Pressable
            key={tab.key}
            onPress={() => handleTap(tab.key)}
            style={styles.tab}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: active }}
          >
            <Icon
              size={26}
              color={active ? ACTIVE_COLOR : INACTIVE_COLOR}
              weight={active ? 'fill' : 'regular'}
            />
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
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    paddingTop: 8,
    paddingHorizontal: 8,
    borderTopWidth: 0.5,
    borderTopColor: Brand.navBarHairline,
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
});
