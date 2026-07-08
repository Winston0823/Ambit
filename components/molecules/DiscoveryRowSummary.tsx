import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Brand,
  AmbitFont,
  Radii,
  TypeScale,
} from '../../constants/theme';
import type { DiscoveryCardData } from '../../data/mock';

interface Props {
  card: DiscoveryCardData;
  onPress?: () => void;
  /// Trailing slot — used by Saved to render an unsave button.
  trailing?: React.ReactNode;
}

/// Compact horizontal bar version of a Discovery card. Used in two places:
///   - DiscoveryOverview (5-skip recovery interstitial)
///   - Saved screen
///
/// Layout: 48pt circular avatar/gradient swatch, then a 2-line meta column:
///   line 1: name/title in display font
///   line 2: 1-line vibe/pitch in body font, truncated
/// Skills appear below as a wrap-row of tiny pill labels (smaller than Chip).
export function DiscoveryRowSummary({ card, onPress, trailing }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="button"
    >
      {card.kind === 'seeker' ? (
        <View style={[styles.swatch, { backgroundColor: Brand.seekerSurface }]}>
          <Text style={styles.swatchSeekerInitial}>{card.name[0]?.toUpperCase() ?? '?'}</Text>
        </View>
      ) : (
        <LinearGradient
          colors={card.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.swatch}
        >
          <Text style={styles.swatchProjectInitial}>
            {(card.title[0] ?? '').toUpperCase()}
          </Text>
        </LinearGradient>
      )}

      <View style={styles.meta}>
        <Text style={styles.title} numberOfLines={1}>
          {card.kind === 'seeker' ? card.name : card.title}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {card.kind === 'seeker' ? card.vibeBlurb : card.pitch}
        </Text>
        <View style={styles.miniChipRow}>
          {(card.kind === 'seeker' ? card.skills : card.skillsSought)
            .slice(0, 3)
            .map((s) => (
              <View key={s} style={styles.miniChip}>
                <Text style={styles.miniChipLabel}>{s}</Text>
              </View>
            ))}
        </View>
      </View>

      {trailing}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: Brand.surface1,
    borderRadius: Radii.md,
  },
  rowPressed: {
    backgroundColor: Brand.surface2,
  },

  swatch: {
    width: 48,
    height: 48,
    borderRadius: Radii.lg, // squared avatar (~25% of size), not a circle
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchSeekerInitial: {
    fontFamily: AmbitFont.display,
    fontSize: 22,
    color: Brand.seekerInk,
  },
  swatchProjectInitial: {
    fontFamily: AmbitFont.display,
    fontSize: 22,
    color: Brand.inkOnBrand,
  },

  meta: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontFamily: AmbitFont.display,
    fontSize: 16,
    color: Brand.inkPrimary,
  },
  sub: {
    ...TypeScale.helper,
    color: Brand.inkMuted,
  },

  miniChipRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  miniChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: Brand.canvas,
    borderRadius: Radii.pill,
    borderWidth: 1,
    borderColor: Brand.borderDefault,
  },
  miniChipLabel: {
    fontFamily: AmbitFont.body,
    fontSize: 11,
    color: Brand.inkBody,
  },
});

