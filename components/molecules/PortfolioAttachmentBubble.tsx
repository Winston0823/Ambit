import React from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { PortfolioItem } from '../../data/mock';
import { AmbitFont, Astra } from '../../constants/theme';

interface Props {
  item: PortfolioItem;
  isMine: boolean;
  onPress: () => void;
}

/// Tappable portfolio-highlight card rendered in place of a normal message
/// bubble when a message carries portfolio_ref_id. Deliberately the SAME shell
/// as ProjectAttachmentBubble (the attachment a reach-out produces) so the two
/// kinds read as one family: dark card, full-bleed backdrop, top→bottom scrim,
/// eyebrow + big display title + italic teaser (quote glyph) + frosted chips.
/// Portfolio is image-forward, so the cover photo is the backdrop when present.
export function PortfolioAttachmentBubble({ item, isMine, onPress }: Props) {
  const tools = (item.tools ?? []).slice(0, 3);
  const teaser = (item.contributions && item.contributions[0]) || item.description;
  const eyebrow = ['PORTFOLIO', (item.timeframe ?? '').toUpperCase()].filter(Boolean).join(' · ');
  const initial = (item.title[0] ?? '').toUpperCase();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
      accessibilityRole="button"
      accessibilityLabel={`View highlight ${item.title}`}
    >
      {/* Backdrop — the cover photo (image-forward), else the warm gradient. */}
      {item.imageUri ? (
        <Image source={{ uri: item.imageUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <>
          <LinearGradient colors={item.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          {initial !== '' && (
            <Text style={styles.watermark} numberOfLines={1} pointerEvents="none" allowFontScaling={false}>{initial}</Text>
          )}
        </>
      )}

      {/* Top→bottom dark scrim so the bottom content reads cleanly. */}
      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.28)', 'rgba(0,0,0,0.72)', 'rgba(0,0,0,0.94)']}
        locations={[0, 0.26, 0.56, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={styles.stack}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
        {!!teaser && (
          <View style={styles.vibeBlock}>
            <Text style={styles.vibeGlyph} allowFontScaling={false} numberOfLines={1} pointerEvents="none">{'“'}</Text>
            <Text style={styles.pitch} numberOfLines={2}>{teaser}</Text>
          </View>
        )}
        {tools.length > 0 && (
          <View style={styles.chipRow}>
            {tools.map((t) => (
              <View key={t} style={styles.chip}>
                <Text style={styles.chipText} numberOfLines={1}>{t}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 268,
    borderRadius: 16,
    backgroundColor: Astra.void,
    overflow: 'hidden',
    paddingTop: 92,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  watermark: {
    position: 'absolute',
    top: 14,
    right: 16,
    fontFamily: AmbitFont.display,
    fontSize: 56,
    color: 'rgba(255,255,255,0.16)',
    letterSpacing: 1,
  },
  stack: { gap: 8 },
  eyebrow: {
    fontFamily: AmbitFont.bold,
    fontSize: 9.5,
    color: 'rgba(255, 255, 255, 0.7)',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: AmbitFont.display,
    fontSize: 23,
    color: '#FFFFFF',
    letterSpacing: -0.4,
    lineHeight: 27,
    marginTop: -1,
  },
  vibeBlock: { position: 'relative', paddingTop: 2 },
  vibeGlyph: {
    position: 'absolute',
    top: -28,
    left: -8,
    fontSize: 72,
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
    fontStyle: 'italic',
    color: 'rgba(153, 117, 206, 0.5)',
    includeFontPadding: false,
    zIndex: 0,
  },
  pitch: {
    position: 'relative',
    zIndex: 1,
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
    fontStyle: 'italic',
    fontSize: 14.5,
    color: 'rgba(255, 255, 255, 0.92)',
    lineHeight: 20,
    letterSpacing: -0.1,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 1 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  chipText: {
    fontFamily: AmbitFont.semibold,
    fontSize: 11.5,
    color: '#FFFFFF',
    letterSpacing: 0.1,
  },
});
