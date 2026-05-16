import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Icon } from '../atoms';
import { Colors, Spacing, Radii } from '../../constants/theme';
import { useHaptics } from '../../hooks/useHaptics';

interface ChatInputProps {
  onSend: (text: string) => void;
  onScheduleCoffee?: () => void;
}

export function ChatInput({ onSend, onScheduleCoffee }: ChatInputProps) {
  const [text, setText] = useState('');
  const haptics = useHaptics();

  const handleSend = () => {
    if (text.trim()) {
      haptics.medium();
      onSend(text.trim());
      setText('');
    }
  };

  return (
    <View style={styles.container}>
      {onScheduleCoffee && (
        <TouchableOpacity style={styles.coffeeButton} onPress={onScheduleCoffee} activeOpacity={0.7}>
          <Icon name="coffee" size={20} color={Colors.brandGreen} />
        </TouchableOpacity>
      )}
      <View style={styles.inputWrapper}>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          placeholderTextColor={Colors.textTertiary}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={1000}
        />
      </View>
      <TouchableOpacity
        style={[styles.sendButton, text.trim() ? styles.sendActive : styles.sendInactive]}
        onPress={handleSend}
        disabled={!text.trim()}
        activeOpacity={0.7}
      >
        <Icon name="send" size={18} color={text.trim() ? Colors.white : Colors.textTertiary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    gap: Spacing.sm,
  },
  coffeeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.badgeGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: Colors.warmGray,
    borderRadius: 20,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    maxHeight: 100,
  },
  input: {
    fontSize: 16,
    color: Colors.textPrimary,
    lineHeight: 22,
    maxHeight: 80,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendActive: {
    backgroundColor: Colors.brandGreen,
  },
  sendInactive: {
    backgroundColor: Colors.warmGray,
  },
});
