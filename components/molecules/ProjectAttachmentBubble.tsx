import React from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { ProjectRefRow } from '../../lib/messaging';
import { AmbitFont, Astra, Brand } from '../../constants/theme';

/// Stable royal→iris gradient derived from the project id, so the same project
/// always renders the same backdrop colors without storing one. Mirrors the
/// discovery card's gradient-fallback when a project has no photo.
const GRADIENTS: [string, string][] = [
  [Astra.royal, Astra.iris],
  [Astra.royal, Astra.selected],
  [Astra.iris, Astra.void],
  [Astra.selected, Astra.royal],
  [Astra.void, Astra.iris],
];
const gradientFor = (id: string): [string, string] => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length];
};

interface Props {
  project: ProjectRefRow;
  isMine: boolean;
  onPress: () => void;
}

/// Tappable project card rendered in place of a normal message bubble when a
/// message carries project_ref_id. A compact echo of the discovery feed's
/// project card: gradient backdrop, dark scrim, eyebrow + big display title +
/// italic pitch (with the decorative quote glyph) + frosted skill chips.
export function ProjectAttachmentBubble({ project, isMine, onPress }: Props) {
  const skills = (project.required_skills ?? []).slice(0, 3);
  const initials = project.title
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
      accessibilityRole="button"
      accessibilityLabel={`View project ${project.title}`}
    >
      {/* Backdrop — the founder's real cover when present, else the warm
          gradient (the discovery photo-fallback look). */}
      <LinearGradient
        colors={gradientFor(project.id)}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {project.image_url ? (
        <Image source={{ uri: project.image_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        initials !== '' && (
          <Text style={styles.watermark} numberOfLines={1} pointerEvents="none" allowFontScaling={false}>
            {initials}
          </Text>
        )
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
        <Text style={styles.eyebrow}>PROJECT</Text>
        <Text style={styles.title} numberOfLines={2}>{project.title}</Text>
        {project.vibe_blurb ? (
          <View style={styles.vibeBlock}>
            <Text style={styles.vibeGlyph} allowFontScaling={false} numberOfLines={1} pointerEvents="none">
              {'“'}
            </Text>
            <Text style={styles.pitch} numberOfLines={2}>{project.vibe_blurb}</Text>
          </View>
        ) : null}
        {skills.length > 0 && (
          <View style={styles.chipRow}>
            {skills.map((s) => (
              <View key={s} style={styles.chip}>
                <Text style={styles.chipText} numberOfLines={1}>{s}</Text>
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
    // Top area is the gradient "photo"; content sits in the scrim below.
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
