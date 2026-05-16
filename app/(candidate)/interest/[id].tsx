import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Badge, Icon } from '../../../components/atoms';
import { InterestNoteInput, NeighborhoodDistance } from '../../../components/molecules';
import { startups } from '../../../data/startups';
import { Colors, Spacing, Typography, Shadows, Radii } from '../../../constants/theme';
import { useHaptics } from '../../../hooks/useHaptics';
import { TouchableOpacity } from 'react-native';
import { ScrollView } from 'react-native';

export default function ExpressInterestScreen() {
  const { id, roleId } = useLocalSearchParams<{ id: string; roleId?: string }>();
  const router = useRouter();
  const haptics = useHaptics();
  const [note, setNote] = useState('');

  const startup = startups.find((s) => s.id === id);
  const role = startup?.roles.find((r) => r.id === roleId) ?? startup?.roles[0];

  if (!startup) {
    return (
      <View style={styles.empty}>
        <Text>Startup not found</Text>
      </View>
    );
  }

  const canSend = note.length >= 50;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Icon name="chevron-left" size={24} color={Colors.textPrimary} />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      <View style={styles.startupCard}>
        <View style={styles.cardHeader}>
          <Image source={{ uri: startup.logo }} style={styles.logo} />
          <View style={styles.cardHeaderText}>
            <Text style={styles.startupName}>{startup.name}</Text>
            <Badge label={startup.stage} variant="stage" />
          </View>
        </View>
        <Text style={styles.oneLiner}>{startup.oneLiner}</Text>
        {role && (
          <View style={styles.roleRow}>
            <Icon name="briefcase" size={14} color={Colors.textSecondary} />
            <Text style={styles.roleTitle}>{role.title}</Text>
            <Text style={styles.roleComp}>{role.compRange}</Text>
          </View>
        )}
        <NeighborhoodDistance neighborhood={startup.neighborhood} distance={startup.distance} />
      </View>

      <InterestNoteInput value={note} onChangeText={setNote} />

      <Button
        title="Send interest"
        variant="pill"
        disabled={!canSend}
        onPress={() => {
          haptics.success();
          Alert.alert(
            'Interest sent!',
            `Your note was sent to ${startup.founder.name} at ${startup.name}. They have 72 hours to respond.`,
            [{ text: 'OK', onPress: () => router.back() }]
          );
        }}
        style={styles.sendButton}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.warmWhite,
  },
  content: {
    padding: Spacing.screen,
    gap: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
  },
  backText: {
    ...Typography.body,
    color: Colors.textPrimary,
  },
  startupCard: {
    backgroundColor: Colors.white,
    borderRadius: Radii.card,
    padding: Spacing.screen,
    gap: Spacing.sm + 4,
    ...Shadows,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm + 4,
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.warmGray,
  },
  cardHeaderText: {
    flex: 1,
    gap: Spacing.xs,
  },
  startupName: {
    ...Typography.name,
  },
  oneLiner: {
    ...Typography.body,
    color: Colors.textSecondary,
    fontSize: 15,
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
    backgroundColor: Colors.warmGray,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radii.tag,
  },
  roleTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    flex: 1,
  },
  roleComp: {
    ...Typography.caption,
    color: Colors.brandGreen,
    fontWeight: '600',
  },
  sendButton: {
    marginTop: Spacing.sm,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
