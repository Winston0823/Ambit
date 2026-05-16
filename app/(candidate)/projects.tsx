import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Brand, AmbitFont, Space, Radii } from '../../constants/theme';

/// Saved Projects (S-024). Placeholder.
export default function ProjectsTab() {
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>SAVED</Text>
      <Text style={styles.title}>Your projects</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Nothing saved yet</Text>
        <Text style={styles.cardBody}>
          Save a project from Discovery and it lands here for later. Spec § 8.3.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.canvas },
  content: { paddingHorizontal: Space.lg, paddingTop: Space.lg, gap: Space.lg },
  eyebrow: { fontFamily: AmbitFont.body, fontSize: 11, letterSpacing: 1.2, color: Brand.inkLabel },
  title: { fontFamily: AmbitFont.display, fontSize: 30, color: Brand.inkPrimary, marginTop: -16 },
  card: { backgroundColor: Brand.surface1, borderRadius: Radii.lg, padding: Space.lg },
  cardTitle: { fontFamily: AmbitFont.body, fontSize: 16, fontWeight: '600', color: Brand.inkHigh },
  cardBody: { fontFamily: AmbitFont.body, fontSize: 13, color: Brand.inkMuted, marginTop: 6, lineHeight: 19 },
});
