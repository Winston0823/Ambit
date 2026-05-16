import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Brand, AmbitFont } from '../../constants/theme';

/// Owner Feed (S-025). Placeholder until real feed is wired.
export default function FounderFeed() {
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>CANDIDATES</Text>
      <Text style={styles.title}>Who's looking</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>No candidates yet</Text>
        <Text style={styles.cardBody}>
          Once you publish a project, matching candidates appear here. Spec § 8.3.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.canvas },
  content: { paddingHorizontal: 24, paddingTop: 24, gap: 24 },
  eyebrow: { fontFamily: AmbitFont.body, fontSize: 11, letterSpacing: 1.2, color: Brand.inkLabel },
  title: { fontFamily: AmbitFont.display, fontSize: 30, color: Brand.inkPrimary, marginTop: -16 },
  card: { backgroundColor: Brand.surface1, borderRadius: 16, padding: 24 },
  cardTitle: { fontFamily: AmbitFont.body, fontSize: 16, fontWeight: '600', color: Brand.inkHigh },
  cardBody: { fontFamily: AmbitFont.body, fontSize: 13, color: Brand.inkMuted, marginTop: 6, lineHeight: 19 },
});
