import React from 'react';
import { View, Image, Text, StyleSheet, TouchableOpacity } from 'react-native';
// Reanimated entrance animation removed — was failing through worklet plugin chain.
// Restore later via withSpring on a shared value once pipeline is verified.
import { NeighborhoodDistance, SkillTagGroup, ActionBar } from '../molecules';
import { Colors, Spacing, Radii, Shadows, Typography } from '../../constants/theme';
import { Candidate } from '../../data/types';

interface CandidateCardProps {
  candidate: Candidate;
  index: number;
  onChat: () => void;
  onPass: () => void;
  onSave: () => void;
  onPress: () => void;
}

export function CandidateCard({ candidate, index, onChat, onPass, onSave, onPress }: CandidateCardProps) {
  return (
    <View>
      <TouchableOpacity style={styles.card} activeOpacity={0.95} onPress={onPress}>
        <Image source={{ uri: candidate.photo }} style={styles.photo} />
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.name}>{candidate.name}</Text>
            <NeighborhoodDistance neighborhood={candidate.neighborhood} distance={candidate.distance} />
          </View>
          <Text style={styles.vibe} numberOfLines={3}>{candidate.vibeBlurb}</Text>
          <SkillTagGroup skills={candidate.skills} max={5} />
          <ActionBar onChat={onChat} onPass={onPass} onSave={onSave} />
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radii.card,
    ...Shadows,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: 280,
    backgroundColor: Colors.warmGray,
  },
  content: {
    padding: Spacing.screen,
    gap: Spacing.sm + 4,
  },
  header: {
    gap: Spacing.xs + 2,
  },
  name: {
    ...Typography.name,
    fontSize: 22,
  },
  vibe: {
    ...Typography.vibe,
  },
});
