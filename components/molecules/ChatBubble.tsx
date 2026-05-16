import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Spacing, Radii, Typography } from '../../constants/theme';
import { Icon } from '../atoms';

interface ChatBubbleProps {
  text: string;
  isSender: boolean;
  timestamp: string;
  type?: 'text' | 'coffee';
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function ChatBubble({ text, isSender, timestamp, type = 'text' }: ChatBubbleProps) {
  if (type === 'coffee') {
    return (
      <View style={[styles.coffeeContainer, isSender ? styles.senderAlign : styles.receiverAlign]}>
        <View style={styles.coffeeBubble}>
          <Text style={styles.coffeeEmoji}>☕</Text>
          <Text style={styles.coffeeText}>{text}</Text>
        </View>
        <Text style={[styles.timestamp, isSender ? styles.timestampRight : styles.timestampLeft]}>
          {formatTime(timestamp)}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, isSender ? styles.senderAlign : styles.receiverAlign]}>
      <View style={[styles.bubble, isSender ? styles.senderBubble : styles.receiverBubble]}>
        <Text style={[styles.text, isSender ? styles.senderText : styles.receiverText]}>{text}</Text>
      </View>
      <Text style={[styles.timestamp, isSender ? styles.timestampRight : styles.timestampLeft]}>
        {formatTime(timestamp)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.xs,
    maxWidth: '80%',
  },
  senderAlign: {
    alignSelf: 'flex-end',
  },
  receiverAlign: {
    alignSelf: 'flex-start',
  },
  bubble: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderRadius: 18,
  },
  senderBubble: {
    backgroundColor: Colors.brandGreen,
    borderBottomRightRadius: 4,
  },
  receiverBubble: {
    backgroundColor: Colors.warmGray,
    borderBottomLeftRadius: 4,
  },
  text: {
    fontSize: 16,
    lineHeight: 22,
  },
  senderText: {
    color: Colors.white,
  },
  receiverText: {
    color: Colors.textPrimary,
  },
  timestamp: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  timestampRight: {
    textAlign: 'right',
  },
  timestampLeft: {
    textAlign: 'left',
  },
  coffeeContainer: {
    marginBottom: Spacing.xs,
    maxWidth: '80%',
  },
  coffeeBubble: {
    backgroundColor: '#FFF8F0',
    borderRadius: 18,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderWidth: 1,
    borderColor: '#F0E6D6',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  coffeeEmoji: {
    fontSize: 20,
  },
  coffeeText: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.textPrimary,
    flex: 1,
  },
});
