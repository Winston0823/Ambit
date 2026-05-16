import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Brand, AmbitFont, Space, Radii } from '../../constants/theme';

/// Chat thread inbox (S-050). Placeholder until Stream Chat is wired.
export default function ChatTab() {
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>CONVERSATIONS</Text>
      <Text style={styles.title}>Where teams come together</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Nothing here yet</Text>
        <Text style={styles.cardBody}>
          Express interest in a project from Discovery. When the owner opens chat,
          it lands here. Spec § 8.5.
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
