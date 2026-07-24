import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { X } from 'phosphor-react-native';
import { AVATAR_IDS, avatarSource } from '../atoms';
import { AmbitFont, Brand, Radii, Space } from '../../constants/theme';

interface Props {
  visible:      boolean;
  selectedId:   string | null;
  onSelect:     (id: string) => void;
  onClose:      () => void;
}

/// Bottom sheet presenting the 12 monster marks in a 3-column grid. The
/// current selection is ringed in `Brand.selected`. Picking a monster fires
/// `onSelect(id)` then `onClose()` so the caller can persist and dismiss in
/// one gesture.
export function AvatarPickerSheet({ visible, selectedId, onSelect, onClose }: Props) {
  const handlePick = (id: string) => {
    onSelect(id);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Inner press is a no-op to swallow taps inside the sheet itself */}
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.kicker}>PICK YOUR MARK</Text>
            <Pressable hitSlop={10} onPress={onClose} accessibilityLabel="Close">
              <X size={18} color={Brand.inkMuted} weight="bold" />
            </Pressable>
          </View>

          <View style={styles.grid}>
            {AVATAR_IDS.map((id) => {
              const selected = id === selectedId;
              return (
                <Pressable
                  key={id}
                  onPress={() => handlePick(id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={({ pressed }) => [
                    styles.cell,
                    selected && styles.cellSelected,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Image
                    source={avatarSource(id)}
                    style={styles.avatar}
                    contentFit="contain"
                  />
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Brand.cardCream,
    borderTopLeftRadius: Radii.lg,
    borderTopRightRadius: Radii.lg,
    paddingHorizontal: Space.lg,
    paddingTop: 12,
    paddingBottom: 32,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Brand.borderDefault,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  kicker: {
    fontFamily: AmbitFont.semibold,
    fontSize: 12,
    letterSpacing: 1.5,
    color: Brand.inkLabel,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Space.md,
    // Fixed-size cells never fill the sheet width exactly, so without this
    // the whole grid hugs the left edge and the leftover width pools on the
    // right. Centering splits the slack evenly.
    justifyContent: 'center',
  },
  cell: {
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brand.seekerSurface,
    borderRadius: Radii.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cellSelected: {
    borderColor: Brand.selected,
  },
  avatar: {
    width: 72,
    height: 72,
  },
});
