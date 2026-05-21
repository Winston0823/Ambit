import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../atoms';
import { DiscoveryRowSummary } from '../molecules';
import {
  AmbitFont,
  Brand,
  Space,
  TypeScale,
} from '../../constants/theme';
import type { DiscoveryCardData } from '../../data/mock';

interface Props {
  /// The 5 most recently passed cards, in the order they were skipped.
  seen: DiscoveryCardData[];
  /// User tapped a row — caller should reinsert that card at the head of
  /// the deck and dismiss this interstitial.
  onPick: (card: DiscoveryCardData) => void;
  /// User accepted moving on — clear the recent-five buffer and continue.
  onContinue: () => void;
}

/// Full-screen recovery interstitial. Surfaces after 5 consecutive skips
/// with no save and no message-send. The premise: when someone's swiping
/// fast, they often regret it a few cards later — give them one chance
/// to claw back the recent five before refilling the deck.
///
/// Layout:
///   ┌ headline + subtitle ───────────────────────────┐
///   │ ─── 5 row summaries (tap to reopen card) ───── │
///   │ ── [ Continue with new picks ] ──────────────  │
///   └────────────────────────────────────────────────┘
export function DiscoveryOverview({ seen, onPick, onContinue }: Props) {
  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headline}>Take another look</Text>
        <Text style={styles.subtitle}>
          You moved through these fast. Anyone worth a second pass?
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      >
        {seen.map((card) => (
          <DiscoveryRowSummary
            key={card.id}
            card={card}
            onPress={() => onPick(card)}
          />
        ))}
      </ScrollView>

      <View style={styles.cta}>
        <Button title="Continue with new picks" onPress={onContinue} trailingArrow />
      </View>
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
    paddingTop: Space.md,
    marginBottom: Space.md,
  },
  headline: {
    fontFamily: AmbitFont.display,
    fontSize: 28,
    color: Brand.inkPrimary,
    lineHeight: 34,
  },
  subtitle: {
    ...TypeScale.body,
    color: Brand.inkMuted,
    marginTop: 8,
  },
  list: {
    paddingHorizontal: Space.lg,
    paddingBottom: 120, // clears the CTA + nav bar
    gap: 10,
  },
  cta: {
    position: 'absolute',
    left: Space.lg,
    right: Space.lg,
    bottom: 24,
  },
});
