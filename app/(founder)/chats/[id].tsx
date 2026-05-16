import React, { useState, useMemo, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import BottomSheet from '@gorhom/bottom-sheet';
import { ChatTemplate } from '../../../components/templates';
import { ProfileSidebar } from '../../../components/organisms';
import { Icon, Badge } from '../../../components/atoms';
import { conversations } from '../../../data/conversations';
import { candidates } from '../../../data/candidates';
import { Colors, Spacing, Typography } from '../../../constants/theme';
import { Message } from '../../../data/types';

export default function FounderChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['60%', '90%'], []);

  const conversation = conversations.find((c) => c.id === id);
  const candidate = conversation ? candidates.find((c) => c.id === conversation.candidateId) : null;

  const [messages, setMessages] = useState<Message[]>(conversation?.messages ?? []);

  const handleSend = useCallback((text: string) => {
    const newMsg: Message = {
      id: `m-${Date.now()}`,
      senderId: conversation?.founderId ?? 'f1',
      text,
      timestamp: new Date().toISOString(),
      type: 'text',
    };
    setMessages((prev) => [...prev, newMsg]);
  }, [conversation]);

  const handleScheduleCoffee = useCallback(() => {
    const coffeeMsg: Message = {
      id: `m-${Date.now()}`,
      senderId: conversation?.founderId ?? 'f1',
      text: 'Coffee chat this week?',
      timestamp: new Date().toISOString(),
      type: 'coffee',
    };
    setMessages((prev) => [...prev, coffeeMsg]);
  }, [conversation]);

  if (!conversation || !candidate) {
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
          <Text style={styles.headerName}>{candidate.name}</Text>
          <Badge label={candidate.neighborhood} variant="neighborhood" />
        </View>
        <TouchableOpacity
          onPress={() => bottomSheetRef.current?.snapToIndex(0)}
          style={styles.profileButton}
        >
          <Icon name="user" size={20} color={Colors.brandGreen} />
        </TouchableOpacity>
      </View>

      <ChatTemplate
        messages={messages}
        currentUserId={conversation.founderId}
        onSend={handleSend}
        onScheduleCoffee={handleScheduleCoffee}
      />

      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backgroundStyle={{ backgroundColor: Colors.warmWhite, borderRadius: 20 }}
        handleIndicatorStyle={{ backgroundColor: Colors.textTertiary, width: 40 }}
      >
        <ProfileSidebar candidate={candidate} />
      </BottomSheet>
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
  profileButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.badgeGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
