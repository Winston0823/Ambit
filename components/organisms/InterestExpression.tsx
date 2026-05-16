import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Avatar, Badge, Icon } from '../atoms';
import { TimerBadge } from '../molecules';
import { Colors, Spacing, Radii, Shadows, Typography } from '../../constants/theme';
import { Interest, Candidate, Startup, Role } from '../../data/types';
import { useHaptics } from '../../hooks/useHaptics';

interface InterestExpressionProps {
  interest: Interest;
  candidate: Candidate;
  startup: Startup;
  role: Role | undefined;
  onOpenChat: () => void;
  onPass: () => void;
  onSave: () => void;
}

export function InterestExpression({
  interest,
  candidate,
  startup,
  role,
  onOpenChat,
  onPass,
  onSave,
}: InterestExpressionProps) {
  const haptics = useHaptics();

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Avatar uri={candidate.photo} name={candidate.name} size="md" />
        <View style={styles.headerText}>
          <Text style={styles.name}>{candidate.name}</Text>
          <View style={styles.metaRow}>
            <Badge label={candidate.neighborhood} variant="neighborhood" />
            <Text style={styles.distance}>{candidate.distance} away</Text>
          </View>
        </View>
        <TimerBadge hoursRemaining={interest.hoursRemaining} />
      </View>

      <Text style={styles.note}>"{interest.note}"</Text>

      {role && (
        <View style={styles.roleTag}>
          <Icon name="briefcase" size={14} color={Colors.textSecondary} />
          <Text style={styles.roleText}>Interested in: {role.title}</Text>
        </View>
      )}

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.chatAction]}
          onPress={() => { haptics.medium(); onOpenChat(); }}
        >
          <Icon name="message-circle" size={18} color={Colors.white} />
          <Text style={[styles.actionText, { color: Colors.white }]}>Open chat</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.passAction]}
          onPress={() => { haptics.light(); onPass(); }}
        >
          <Icon name="x" size={18} color={Colors.coral} />
          <Text style={[styles.actionText, { color: Colors.coral }]}>Pass</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.saveAction]}
          onPress={() => { haptics.light(); onSave(); }}
        >
          <Icon name="bookmark" size={18} color={Colors.softBlue} />
          <Text style={[styles.actionText, { color: Colors.softBlue }]}>Save</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radii.card,
    padding: Spacing.screen,
    ...Shadows,
    gap: Spacing.sm + 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm + 4,
  },
  headerText: {
    flex: 1,
    gap: Spacing.xs,
  },
  name: {
    ...Typography.name,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  distance: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  note: {
    ...Typography.body,
    fontStyle: 'italic',
    color: Colors.textSecondary,
    lineHeight: 24,
  },
  roleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
    backgroundColor: Colors.warmGray,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radii.tag,
    alignSelf: 'flex-start',
  },
  roleText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs + 2,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radii.button,
  },
  chatAction: {
    backgroundColor: Colors.brandGreen,
  },
  passAction: {
    backgroundColor: Colors.badgeCoral,
  },
  saveAction: {
    backgroundColor: Colors.badgeBlue,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
