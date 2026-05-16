import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Brand } from '../../constants/theme';

export default function CandidateProjects() {
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>SAVED</Text>
        <Text style={styles.title}>Your projects</Text>
        <Text style={styles.subtitle}>
          Startups you've saved and conversations in motion will live here.
        </Text>

        <View style={styles.placeholderCard}>
          <Text style={styles.placeholderTitle}>Nothing saved yet</Text>
          <Text style={styles.placeholderBody}>
            When you tap save on a startup card, it lands here so you can come
            back to it later.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Brand.canvas,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 140,
  },
  eyebrow: {
    fontSize: 11,
    color: Brand.inkLabel,
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: Brand.inkPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: Brand.inkMuted,
    lineHeight: 22,
    marginBottom: 32,
  },
  placeholderCard: {
    backgroundColor: Brand.surface1,
    borderRadius: 16,
    padding: 24,
  },
  placeholderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Brand.inkHigh,
    marginBottom: 6,
  },
  placeholderBody: {
    fontSize: 13,
    color: Brand.inkMuted,
    lineHeight: 19,
  },
});
