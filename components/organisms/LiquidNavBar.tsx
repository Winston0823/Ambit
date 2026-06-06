import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  AppState,
  Easing,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  UIManager,
  View,
} from 'react-native';
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
  { key: 'profile',   label: 'Me!',       inactiveIcon: UserCircleDashed, activeIcon: UserCircle  },
];

interface Props {
  activeKey: NavTabKey;
  onChange: (key: NavTabKey) => void;
  /// When true the bar slides down off the bottom edge and gives back its
  /// layout slot so the screen above reclaims the space (used inside a
  /// conversation thread for a full-canvas chat). Slides back up on exit.
  /// Animated entirely within this component.
  hidden?: boolean;
  /// Tabs that should show an unread dot. Callers pass a new Set each
  /// render so the component stays purely presentational.
  badgeTabs?: Set<NavTabKey>;
}

const ACTIVE_COLOR   = Brand.action;                      // teal active icon on dark nav
const INACTIVE_COLOR = 'rgba(255, 255, 255, 0.55)';

/// Icon glyph size. Bumped from 26 → 28 to sit closer to Instagram's
/// chunkier bottom-bar weight. Paired with taller tab padding below so the
/// whole bar reads larger, not just the icons.
const ICON_SIZE = 28;

// LayoutAnimation opt-in for Android (iOS is on by default). Safe to call
// repeatedly — RN no-ops after the first.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/// Anchored bottom tab bar. Active tab is marked by an icon swap from
/// outline → fill weight (or a distinct fill variant). Icon-only — no
/// labels, so the bar stays quiet and the cue is purely visual.
///
/// Retract motion: the SLIDE is a `translateY` on the NATIVE driver, so it
/// stays smooth even while the JS thread is busy with the screen transition
/// / thread unmount (an earlier height-collapse version animated layout on
/// the JS thread — it stuttered and snapped on the way back up). The layout
/// space is reserved/reclaimed in DISCRETE steps (a boolean `reserved`),
/// never per frame: showing reserves the slot then slides up into it;
/// hiding slides away then reclaims the slot in one smooth LayoutAnimation
/// step so the thread's composer eases to the bottom instead of jumping.
/// One nav button. Owns a spring that runs 0→1 as its tab becomes active —
/// the icon pops up + lifts slightly on entry and settles back on leave, so
/// every tab change is physically acknowledged. Native-driver transform only.
function NavTabButton({
  tab,
  active,
  hasBadge,
  onPress,
}: {
  tab: NavTab;
  active: boolean;
  hasBadge: boolean;
  onPress: () => void;
}) {
  const a = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(a, {
      toValue: active ? 1 : 0,
      friction: 6,
      tension: 150,
      useNativeDriver: true,
    }).start();
  }, [active, a]);

  const Icon = active ? tab.activeIcon : tab.inactiveIcon;
  const scale = a.interpolate({ inputRange: [0, 1], outputRange: [1, 1.14] });
  const translateY = a.interpolate({ inputRange: [0, 1], outputRange: [0, -3] });

  return (
    <Pressable
      onPress={onPress}
      style={styles.tab}
      accessibilityRole="tab"
      accessibilityLabel={tab.label}
      accessibilityState={{ selected: active }}
    >
      <Animated.View style={[styles.iconWrap, { transform: [{ scale }, { translateY }] }]}>
        <Icon
          size={ICON_SIZE}
          color={active ? ACTIVE_COLOR : INACTIVE_COLOR}
          weight={active ? 'fill' : 'regular'}
        />
        {hasBadge && <View style={styles.badge} />}
      </Animated.View>
    </Pressable>
  );
}

export function LiquidNavBar({ activeKey, onChange, hidden = false, badgeTabs }: Props) {
  const insets = useSafeAreaInsets();

  /// Natural bar height, measured once from the inner row — drives the
  /// slide distance.
  const [barHeight, setBarHeight] = useState(0);
  /// Native slide driver. 0 = shown, 1 = slid fully below the bottom edge.
  const slide = useRef(new Animated.Value(hidden ? 1 : 0)).current;
  /// Whether the bar occupies layout space. Toggled only at the animation
  /// boundaries so the slide never causes a per-frame relayout.
  const [reserved, setReserved] = useState(!hidden);

  useEffect(() => {
    if (!hidden) {
      // SHOW: reserve the slot up front, then slide up into it.
      setReserved(true);
      const anim = Animated.timing(slide, {
        toValue: 0,
        duration: 380,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });
      anim.start();
      return () => anim.stop();
    }
    // HIDE: slide down, then reclaim the slot in one smooth layout step.
    const anim = Animated.timing(slide, {
      toValue: 1,
      duration: 300,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start(({ finished }) => {
      if (!finished) return;
      LayoutAnimation.configureNext({ duration: 220, update: { type: 'easeInEaseOut' } });
      setReserved(false);
    });
    return () => anim.stop();
  }, [hidden, slide]);

  // Foreground safety net: if the app was backgrounded mid-slide, snap to a
  // clean resting state on return so the bar can never freeze half-way.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return;
      slide.setValue(hidden ? 1 : 0);
      setReserved(!hidden);
    });
    return () => sub.remove();
  }, [hidden, slide]);

  // Slide the full bar height plus the bottom inset so it clears the edge
  // completely. translateY is a transform — it never touches the bar's
  // internal padding, so a stale value can't clip the icons.
  const translateY =
    barHeight === 0
      ? 0
      : slide.interpolate({
          inputRange: [0, 1],
          outputRange: [0, barHeight + insets.bottom],
        });

  const handleTap = (key: NavTabKey) => {
    if (key === activeKey) return;
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    onChange(key);
  };

  return (
    <Animated.View
      style={[reserved ? null : styles.reclaimed, { transform: [{ translateY }] }]}
      pointerEvents={hidden ? 'none' : 'auto'}
    >
      <View
        style={[
          styles.bar,
          // Shadow only while shown — otherwise the bar casts it onto the
          // thread content as it slides down (a stray shadow "beneath" the
          // descending bar). On the way up the bar enters from below the
          // edge, so its downward shadow stays off-screen.
          !hidden && styles.barShadow,
          { paddingBottom: Math.max(insets.bottom, 8) },
        ]}
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          if (h > 0 && Math.abs(h - barHeight) > 0.5) setBarHeight(h);
        }}
      >
        {TABS.map((tab) => (
          <NavTabButton
            key={tab.key}
            tab={tab}
            active={tab.key === activeKey}
            hasBadge={badgeTabs?.has(tab.key) ?? false}
            onPress={() => handleTap(tab.key)}
          />
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // When the bar is hidden it gives back its layout slot (height 0) so the
  // screen above reclaims the space; overflow:hidden clips the slid-away bar.
  reclaimed: {
    height: 0,
    overflow: 'hidden',
  },
  bar: {
    flexDirection: 'row',
    backgroundColor: Brand.navBarBg,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    paddingTop: 14,
    paddingHorizontal: 8,
    borderTopWidth: 0.5,
    borderTopColor: Brand.navBarHairline,
  },
  // Floating separation shadow — applied only when the bar is shown (see
  // the inline `!hidden` guard) so it never gets cast onto content mid-slide.
  barShadow: {
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
    // Taller tap targets so the bar's overall height grows toward
    // Instagram's, not just the icon glyphs.
    paddingVertical: 8,
  },
  iconWrap: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -1,
    right: -3,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#FF3B30',
    borderWidth: 1.5,
    // Border matches the nav bar background so the dot appears to "cut out"
    // from the surface rather than overlay it.
    borderColor: Brand.navBarBg,
  },
});
