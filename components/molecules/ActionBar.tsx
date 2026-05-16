import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Icon } from '../atoms';
import { Colors, Spacing } from '../../constants/theme';
import { useHaptics } from '../../hooks/useHaptics';

interface ActionBarProps {
  onChat: () => void;
  onPass: () => void;
  onSave: () => void;
}

export function ActionBar({ onChat, onPass, onSave }: ActionBarProps) {
  const haptics = useHaptics();

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.button, styles.passButton]}
        onPress={() => { haptics.light(); onPass(); }}
        activeOpacity={0.7}
      >
        <Icon name="x" size={22} color={Colors.coral} />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.chatButton]}
        onPress={() => { haptics.medium(); onChat(); }}
        activeOpacity={0.7}
      >
        <Icon name="message-circle" size={24} color={Colors.white} />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.saveButton]}
        onPress={() => { haptics.light(); onSave(); }}
        activeOpacity={0.7}
      >
        <Icon name="bookmark" size={20} color={Colors.softBlue} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  button: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatButton: {
    backgroundColor: Colors.brandGreen,
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  passButton: {
    backgroundColor: Colors.badgeCoral,
  },
  saveButton: {
    backgroundColor: Colors.badgeBlue,
  },
});
