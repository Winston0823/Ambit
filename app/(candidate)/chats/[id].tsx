import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChatTemplate } from '../../../components/templates';
import { Icon, Badge } from '../../../components/atoms';
import { conversations } from '../../../data/conversations';
import { startups } from '../../../data/startups';
import { Colors, Spacing, Typography } from '../../../constants/theme';
import { Message } from '../../../data/types';

export default function CandidateChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const conversation = conversations.find((c) => c.id === id);
  const startup = conversation ? startups.find((s) => s.id === conversation.startupId) : null;

  const [messages, setMessages] = useState<Message[]>(conversation?.messages ?? []);

  const handleSend = useCallback((text: string) => {
    const newMsg: Message = {
      id: `m-${Date.now()}`,
      senderId: conversation?.candidateId ?? '1',
      text,
      timestamp: new Date().toISOString(),
      type: 'text',
    };
    setMessages((prev) => [...prev, newMsg]);
  }, [conversation]);

  if (!conversation || !startup) {
    return (
      <View style={styles.empty}>
        <Text>Conversation not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Icon name="chevron-left" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>{startup.name}</Text>
          <Badge label={startup.neighborhood} variant="neighborhood" />
        </View>
      </View>

      <ChatTemplate
        messages={messages}
        currentUserId={conversation.candidateId}
        onSend={handleSend}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.warmWhite,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 4,
    backgroundColor: Colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  backButton: {
    padding: Spacing.xs,
  },
  headerInfo: {
    flex: 1,
    gap: Spacing.xs,
  },
  headerName: {
    ...Typography.name,
    fontSize: 17,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
