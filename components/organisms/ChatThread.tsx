import React, { useRef } from 'react';
import { FlatList, View, Text, StyleSheet } from 'react-native';
import { ChatBubble } from '../molecules';
import { Colors, Spacing, Typography } from '../../constants/theme';
import { Message } from '../../data/types';

interface ChatThreadProps {
  messages: Message[];
  currentUserId: string;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}

function shouldShowDateSeparator(messages: Message[], index: number): boolean {
  if (index === 0) return true;
  const current = new Date(messages[index].timestamp).toDateString();
  const previous = new Date(messages[index - 1].timestamp).toDateString();
  return current !== previous;
}

export function ChatThread({ messages, currentUserId }: ChatThreadProps) {
  const flatListRef = useRef<FlatList>(null);

  return (
    <FlatList
      ref={flatListRef}
      data={messages}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
      renderItem={({ item, index }) => (
        <View>
          {shouldShowDateSeparator(messages, index) && (
            <View style={styles.dateSeparator}>
              <Text style={styles.dateText}>{formatDate(item.timestamp)}</Text>
            </View>
          )}
          <ChatBubble
            text={item.text}
            isSender={item.senderId === currentUserId}
            timestamp={item.timestamp}
            type={item.type}
          />
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.md,
    paddingBottom: Spacing.xl,
    gap: Spacing.xs,
  },
  dateSeparator: {
    alignItems: 'center',
    marginVertical: Spacing.md,
  },
  dateText: {
    ...Typography.caption,
    fontSize: 12,
    color: Colors.textTertiary,
    backgroundColor: Colors.warmGray,
    paddingHorizontal: Spacing.sm + 4,
    paddingVertical: Spacing.xs,
    borderRadius: 10,
    overflow: 'hidden',
  },
});
