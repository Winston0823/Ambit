import React from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { ChatListItem } from '../../../components/organisms';
import { Divider } from '../../../components/atoms';
import { conversations } from '../../../data/conversations';
import { candidates } from '../../../data/candidates';
import { Colors, Spacing, Typography } from '../../../constants/theme';

export default function FounderChats() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Chats</Text>
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        ItemSeparatorComponent={() => <Divider spacing={0} />}
        renderItem={({ item }) => {
          const candidate = candidates.find((c) => c.id === item.candidateId);
          if (!candidate) return null;
          const lastMsg = item.messages[item.messages.length - 1];

          return (
            <ChatListItem
              name={candidate.name}
              photo={candidate.photo}
              neighborhood={candidate.neighborhood}
              lastMessage={lastMsg.type === 'coffee' ? `☕ ${lastMsg.text}` : lastMsg.text}
              timestamp={item.lastMessageAt}
              unreadCount={item.unreadCount}
              onPress={() => router.push(`/(founder)/chats/${item.id}`)}
            />
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.warmWhite,
  },
  title: {
    ...Typography.heading,
    paddingHorizontal: Spacing.screen,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
});
