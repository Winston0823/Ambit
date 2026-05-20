import React from 'react';
import { Platform, Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Brand, AmbitFont } from '../../constants/theme';

interface Props { onPress: () => void; }

/// Self-positioning top-left back chevron.
///
/// Why useSafeAreaInsets and not just SafeAreaView padding: this Pressable
/// is absolutely positioned so callers cannot accidentally displace it via
/// their own root padding. But absolute children ignore their parent's
/// padding — including SafeAreaView's top-inset padding — so we'd render
/// inside the status bar / Dynamic Island. Reading insets.top directly and
/// offsetting from it keeps the chevron clear of system UI on every device.
export function BackChevron({ onPress }: Props) {
  const insets = useSafeAreaInsets();
  const press = () => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
    onPress();
  };
  return (
    <Pressable
      onPress={press}
      hitSlop={8}
      style={[styles.btn, { top: insets.top + 18 }]}
    >
      <Text style={styles.glyph}>‹</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    position: 'absolute',
    left: 12,
    width: 44,
    height: 44,
    paddingLeft: 8,
    justifyContent: 'center',
    zIndex: 10,
  },
  glyph: {
    fontFamily: AmbitFont.body,
    fontSize: 28,
    color: Brand.inkMuted,
    lineHeight: 32,
  },
});
