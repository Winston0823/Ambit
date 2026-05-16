import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Brand, AmbitFont } from '../../constants/theme';

/// Discovery feed (S-020). Placeholder until real feed is wired.
export default function CandidateFeed() {
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>DISCOVER</Text>
      <Text style={styles.title}>What are you building?</Text>

      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.card}>
          <Text style={styles.cardLabel}>Project</Text>
          <Text style={styles.cardTitle}>Card placeholder</Text>
          <Text style={styles.cardBody}>
            Feed cards land here once the Discover API is wired. Spec § 8.3.
          </Text>
        </View>
      ))}

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.canvas },
  content: { paddingHorizontal: 24, paddingTop: 24, gap: 24 },
  eyebrow: { fontFamily: AmbitFont.body, fontSize: 11, letterSpacing: 1.2, color: Brand.inkLabel },
  title: { fontFamily: AmbitFont.display, fontSize: 30, color: Brand.inkPrimary, marginTop: -16 },
  card: { backgroundColor: Brand.surface1, borderRadius: 16, padding: 24 },
  cardLabel: { fontFamily: AmbitFont.body, fontSize: 11, letterSpacing: 1.2, color: Brand.inkLabel },
  cardTitle: { fontFamily: AmbitFont.body, fontSize: 16, fontWeight: '600', color: Brand.inkHigh, marginTop: 6 },
  cardBody: { fontFamily: AmbitFont.body, fontSize: 13, color: Brand.inkMuted, marginTop: 6, lineHeight: 19 },
});
