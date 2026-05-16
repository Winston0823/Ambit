import React from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { ChatThread } from '../organisms/ChatThread';
import { ChatInput } from '../organisms/ChatInput';
import { Colors } from '../../constants/theme';
import { Message } from '../../data/types';

interface ChatTemplateProps {
  messages: Message[];
  currentUserId: string;
  onSend: (text: string) => void;
  onScheduleCoffee?: () => void;
}

export function ChatTemplate({ messages, currentUserId, onSend, onScheduleCoffee }: ChatTemplateProps) {
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      <View style={styles.thread}>
        <ChatThread messages={messages} currentUserId={currentUserId} />
      </View>
      <ChatInput onSend={onSend} onScheduleCoffee={onScheduleCoffee} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.warmWhite,
  },
  thread: {
    flex: 1,
  },
});
