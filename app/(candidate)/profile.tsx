import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Brand, AmbitFont, Space, Radii } from '../../constants/theme';

/// My Profile (S-090). Placeholder.
export default function ProfileTab() {
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>PROFILE</Text>
      <Text style={styles.title}>This is you</Text>

      <View style={[styles.card, { backgroundColor: Brand.seekerSurface }]}>
        <View style={styles.avatar} />
        <Text style={styles.vibeLabel}>VIBE BLURB</Text>
        <Text style={styles.vibeBody}>
          Two to three sentences about who you are. This is what owners read first —
          speak in your own voice.
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
  card: { backgroundColor: Brand.surface1, borderRadius: Radii.lg, padding: Space.lg, gap: 12 },
  avatar: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: Brand.surface2,
  },
  vibeLabel: { fontFamily: AmbitFont.body, fontSize: 11, letterSpacing: 1.2, color: Brand.inkLabel },
  vibeBody: { fontFamily: AmbitFont.body, fontSize: 15, color: Brand.seekerInk, lineHeight: 22 },
});
