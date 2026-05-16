import React from 'react';
import { View, Image, Text, StyleSheet, ScrollView } from 'react-native';
import { Avatar, Badge, Divider } from '../atoms';
import { SkillTagGroup, NeighborhoodDistance, ResponseRateBadge } from '../molecules';
import { Colors, Spacing, Typography } from '../../constants/theme';
import { Candidate } from '../../data/types';

interface ProfileSidebarProps {
  candidate: Candidate;
}

export function ProfileSidebar({ candidate }: ProfileSidebarProps) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Image source={{ uri: candidate.photo }} style={styles.photo} />
      <Text style={styles.name}>{candidate.name}</Text>
      <NeighborhoodDistance neighborhood={candidate.neighborhood} distance={candidate.distance} />
      <ResponseRateBadge rate={candidate.responseRate} />

      <Divider />

      <Text style={styles.sectionTitle}>About</Text>
      <Text style={styles.vibe}>{candidate.vibeBlurb}</Text>

      <Divider />

      <Text style={styles.sectionTitle}>Skills</Text>
      <SkillTagGroup skills={candidate.skills} />

      <Divider />

      <Text style={styles.sectionTitle}>Looking for</Text>
      <Text style={styles.body}>{candidate.lookingFor}</Text>

      {candidate.linkedIn && (
        <>
          <Divider />
          <Text style={styles.sectionTitle}>LinkedIn</Text>
          <Text style={styles.link}>{candidate.linkedIn}</Text>
        </>
      )}

      {candidate.github && (
        <>
          <Divider />
          <Text style={styles.sectionTitle}>GitHub</Text>
          <Text style={styles.link}>{candidate.github}</Text>
        </>
      )}

      <Text style={styles.lastActive}>Active {candidate.lastActive}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.screen,
    gap: Spacing.sm + 4,
    paddingBottom: Spacing.xxxl,
  },
  photo: {
    width: '100%',
    height: 240,
    borderRadius: 16,
    backgroundColor: Colors.warmGray,
  },
  name: {
    ...Typography.heading,
    marginTop: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.label,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontSize: 12,
  },
  vibe: {
    ...Typography.vibe,
  },
  body: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  link: {
    ...Typography.body,
    color: Colors.softBlue,
  },
  lastActive: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: Spacing.md,
  },
});
