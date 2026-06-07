import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Brand, AmbitFont } from '../../constants/theme';

interface ButtonProps { onPress: () => void; }

/// Floating wrench tucked at the bottom-center, beneath the LiquidNavBar
/// icon row. Sits in the nav bar's safe-area padding zone so it doesn't
/// compete with the four tab icons but stays reachable. Bottom-anchored
/// (insets.bottom-aware) so it floats just above the home indicator on
/// notched devices.
export function DebugMenuButton({ onPress }: ButtonProps) {
  const insets = useSafeAreaInsets();
  // 4pt floor on no-notch devices; centered within the safe-area band
  // on notched ones (insets.bottom ≈ 34pt → the button sits ~10pt above
  // the home indicator line and ~6pt below the nav-bar icon row).
  const bottom = Math.max(4, insets.bottom - 24);
  return (
    <Pressable
      onPress={onPress}
      style={[styles.fab, { bottom }]}
      accessibilityLabel="Developer menu"
    >
      <Feather name="tool" size={14} color="#fff" />
    </Pressable>
  );
}

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  onStartOnboarding: () => void;
}

export function DebugMenuSheet({ visible, onClose, onStartOnboarding }: SheetProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.sheetRoot}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Developer</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.doneBtn}>Done</Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>FLOWS</Text>
          <Pressable onPress={onStartOnboarding} style={styles.row}>
            <Feather name="play" size={16} color={Brand.inkPrimary} />
            <Text style={styles.rowLabel}>Start Onboarding</Text>
            <Feather name="chevron-right" size={16} color={Brand.inkMuted} />
          </Pressable>
          <Text style={styles.helper}>
            Walks through Splash → Welcome → .edu → Age → Vibe → Skills → Role → Campus → Photo → Proof → Done.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>BUILD INFO</Text>
          <Row k="App version" v="0.1.0 (1)" />
          <Row k="Platform" v="React Native / Expo" />
          <Row k="Runtime" v="Expo Go (managed)" />
        </View>
      </View>
    </Modal>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { flex: 1 }]}>{k}</Text>
      <Text style={styles.rowValue}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    // Center horizontally regardless of screen width. left:'50%' + a
    // negative marginLeft equal to half the button width is the
    // canonical RN centering trick when the parent isn't a flex layout.
    left: '50%',
    marginLeft: -14, // half of width 28
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    // Translucent fill blends with the dark nav bar background it sits
    // over. A faint border keeps it visible against the dark surface.
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.30)',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  sheetRoot: {
    flex: 1,
    backgroundColor: Brand.surface1,
    padding: 20,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    fontFamily: AmbitFont.display,
    fontSize: 28,
    color: Brand.inkPrimary,
  },
  doneBtn: {
    fontFamily: AmbitFont.body,
    fontSize: 17,
    color: Brand.accent,
    fontWeight: '600',
  },
  section: {
    marginTop: 16,
    backgroundColor: Brand.canvas,
    borderRadius: 16,
    padding: 16,
  },
  sectionLabel: {
    fontFamily: AmbitFont.body,
    fontSize: 11,
    letterSpacing: 1.2,
    color: Brand.inkLabel,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  rowLabel: {
    fontFamily: AmbitFont.body,
    fontSize: 15,
    color: Brand.inkPrimary,
    flex: 1,
  },
  rowValue: {
    fontFamily: AmbitFont.body,
    fontSize: 14,
    color: Brand.inkMuted,
  },
  helper: {
    fontFamily: AmbitFont.body,
    fontSize: 13,
    color: Brand.inkMuted,
    marginTop: 4,
    lineHeight: 18,
  },
});
