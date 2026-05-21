import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Trash } from 'phosphor-react-native';
import { BackChevron } from '../../components/atoms';
import { DiscoveryRowSummary } from '../../components/molecules';
import { useSavedDeck } from '../../context/SavedDeckContext';
import {
  AmbitFont,
  Brand,
  Space,
  TypeScale,
} from '../../constants/theme';

/// Saved list. Reached via the bookmark icon on the Discovery feed.
/// In-memory only for v1 — moves to a `saved_cards` Supabase table later.
export default function SavedScreen() {
  const insets = useSafeAreaInsets();
  const { saved, unsave } = useSavedDeck();

  return (
    <View style={styles.root}>
      <BackChevron onPress={() => router.back()} />

      <View style={[styles.header, { marginTop: insets.top + 40 }]}>
        <Text style={styles.headline}>Saved</Text>
        <Text style={styles.subtitle}>
          {saved.length === 0
            ? 'Nothing saved yet — swipe right on someone you like.'
            : `${saved.length} ${saved.length === 1 ? 'pick' : 'picks'} you want to come back to.`}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      >
        {saved.map((card) => (
          <DiscoveryRowSummary
            key={card.id}
            card={card}
            trailing={
              <Pressable
                onPress={() => unsave(card.id)}
                hitSlop={10}
                style={styles.trashBtn}
                accessibilityLabel="Remove from saved"
              >
                <Trash size={18} color={Brand.inkMuted} weight="regular" />
              </Pressable>
            }
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Brand.canvas,
  },
  header: {
    paddingHorizontal: Space.lg,
    marginBottom: Space.md,
  },
  headline: {
    fontFamily: AmbitFont.display,
    fontSize: 30,
    color: Brand.inkPrimary,
  },
  subtitle: {
    ...TypeScale.body,
    color: Brand.inkMuted,
    marginTop: 8,
  },
  list: {
    paddingHorizontal: Space.lg,
    paddingBottom: 120,
    gap: 10,
  },
  trashBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
