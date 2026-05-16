import React from 'react';
import { View, Image, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Badge, Button, Icon } from '../atoms';
import { NeighborhoodDistance } from '../molecules';
import { Colors, Spacing, Radii, Shadows, Typography } from '../../constants/theme';
import { Startup } from '../../data/types';
import { useHaptics } from '../../hooks/useHaptics';

interface StartupCardProps {
  startup: Startup;
  index: number;
  onInterest: (roleId: string) => void;
  onPress: () => void;
}

export function StartupCard({ startup, index, onInterest, onPress }: StartupCardProps) {
  const haptics = useHaptics();
  const primaryRole = startup.roles[0];

  return (
    <Animated.View
      entering={FadeInUp.springify().damping(15).stiffness(150).mass(0.8).delay(index * 80)}
    >
      <TouchableOpacity style={styles.card} activeOpacity={0.95} onPress={onPress}>
        <View style={styles.header}>
          <Image source={{ uri: startup.logo }} style={styles.logo} />
          <View style={styles.headerText}>
            <Text style={styles.name}>{startup.name}</Text>
            <Badge label={startup.stage} variant="stage" />
          </View>
        </View>

        <Text style={styles.oneLiner}>{startup.oneLiner}</Text>

        {primaryRole && (
          <View style={styles.roleSection}>
            <Text style={styles.roleTitle}>{primaryRole.title}</Text>
            <Text style={styles.comp}>{primaryRole.compRange}</Text>
          </View>
        )}

        <View style={styles.metaRow}>
          <NeighborhoodDistance neighborhood={startup.neighborhood} distance={startup.distance} />
          <View style={styles.vibeRow}>
            <Icon name="home" size={14} color={Colors.textTertiary} />
            <Text style={styles.vibeText}>{startup.officeVibe}</Text>
          </View>
        </View>

        <Button
          title="I'm interested"
          variant="pill"
          onPress={() => {
            haptics.medium();
            onInterest(primaryRole?.id ?? '');
          }}
          style={styles.interestButton}
        />
      </TouchableOpacity>
    </Animated.View>
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
  logo: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: Colors.warmGray,
  },
  headerText: {
    flex: 1,
    gap: Spacing.xs,
  },
  name: {
    ...Typography.name,
    fontSize: 20,
  },
  oneLiner: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  roleSection: {
    backgroundColor: Colors.warmGray,
    borderRadius: Radii.tag,
    padding: Spacing.sm + 4,
    gap: Spacing.xs,
  },
  roleTitle: {
    ...Typography.label,
    color: Colors.textPrimary,
    fontWeight: '600',
    fontSize: 15,
  },
  comp: {
    ...Typography.caption,
    color: Colors.brandGreen,
    fontWeight: '600',
  },
  metaRow: {
    gap: Spacing.sm,
  },
  vibeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
  },
  vibeText: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  interestButton: {
    marginTop: Spacing.xs,
  },
});
