import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MapPin } from 'phosphor-react-native';
import { Button, Chip } from '../../components/atoms';
import { Brand, AmbitFont, Space, Radii, TypeScale } from '../../constants/theme';

/// Discovery feed (S-020) — placeholder until the Discover API is wired.
///
/// Layout (designed for clarity in §8.3):
///   ┌ campus chip  ·  radius        filter  ·  search ┐
///   │  context strip — "why this feed, right now"    │
///   │  ┌ project card                              ┐ │
///   │  │ gradient hero + project initials         │ │
///   │  │ display-font title                       │ │
///   │  │ owner row (avatar · name · campus · mi)  │ │
///   │  │ need chips                               │ │
///   │  │ Express interest CTA                     │ │
///   │  └──────────────────────────────────────────┘ │
///   └─────────────────────────────────────────────────┘
///
/// All tokens — color, type, spacing, radii — pull from constants/theme.

interface MockProject {
  id: string;
  title: string;
  ownerName: string;
  ownerCampus: string;
  distanceMi: number;
  needs: string[];
  /// Two-stop gradient drawn from the warm-tan palette family. Different
  /// stops per card give each project a unique fingerprint until real
  /// banner uploads land.
  gradient: [string, string];
}

const MOCK_PROJECTS: MockProject[] = [
  {
    id: '1',
    title: 'AI Study Tool',
    ownerName: 'Alex Chen',
    ownerCampus: 'Stanford',
    distanceMi: 2.1,
    needs: ['Designer', 'Ops'],
    gradient: [Brand.primary, Brand.accent],
  },
  {
    id: '2',
    title: 'Hardware for student labs',
    ownerName: 'Daria Park',
    ownerCampus: 'SJSU',
    distanceMi: 14.6,
    needs: ['Mechanical', 'Firmware'],
    gradient: ['#C9A57A', Brand.seekerInk],
  },
  {
    id: '3',
    title: 'Campus mental-health app',
    ownerName: 'Maya Patel',
    ownerCampus: 'UC Berkeley',
    distanceMi: 31.2,
    needs: ['Design', 'iOS', 'Research'],
    gradient: [Brand.seekerSurface, Brand.accent],
  },
];

export default function DiscoveryFeed() {
  // No SafeAreaView wrapper — the root _layout.tsx already applies the top
  // inset. Wrapping again double-pads the wordmark below the Dynamic Island.
  return (
    <View style={styles.root}>
      {/* Top bar — Instagram-style wordmark, centered. No right-hand actions
          yet (filter + search return when those features ship). */}
      <View style={styles.topBar}>
        <Text style={styles.wordmark}>ambit</Text>
      </View>

      {/* Campus context — sits one tier below the wordmark so the
          'why am I seeing this' proximity signal stays prominent. */}
      <View style={styles.subBar}>
        <Pressable style={styles.campusChip} accessibilityRole="button">
          <MapPin size={16} color={Brand.inkPrimary} weight="fill" />
          <Text style={styles.campusLabel}>Stanford</Text>
          <Text style={styles.campusRadius}>· 5mi</Text>
        </Pressable>
      </View>

      <Text style={styles.context}>
        3 new projects looking for designers near you
      </Text>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {MOCK_PROJECTS.map((p) => (
          <ProjectCard key={p.id} project={p} />
        ))}
        <View style={{ height: Space.lg }} />
      </ScrollView>
    </View>
  );
}

function ProjectCard({ project }: { project: MockProject }) {
  const initials = project.title
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <View style={styles.card}>
      {/* Hero — gradient with project initials in the display font */}
      <LinearGradient
        colors={project.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <Text style={styles.heroInitials}>{initials}</Text>
      </LinearGradient>

      <View style={styles.cardBody}>
        <Text style={styles.cardTitle}>{project.title}</Text>

        <View style={styles.ownerRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{project.ownerName[0]}</Text>
          </View>
          <Text style={styles.ownerMeta}>
            {project.ownerName}
            <Text style={styles.ownerDot}> · </Text>
            {project.ownerCampus}
            <Text style={styles.ownerDot}> · </Text>
            {project.distanceMi}mi
          </Text>
        </View>

        {/* Need chips — reuse the Chip atom in its unselected (neutral) form
            so the card's primary CTA stays the only warm-tan element. */}
        <View style={styles.chipRow}>
          {project.needs.map((need) => (
            <Chip key={need} label={need} selected={false} />
          ))}
        </View>

        {/* CTA — reuse Button with the project-wide swirl arrow so this
            matches every other primary action in the app. */}
        <Button
          title="Express interest"
          onPress={() => {}}
          trailingArrow
          style={styles.cta}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.canvas },

  // Top bar -----------------------------------------------------
  topBar: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Space.xs,
    paddingBottom: Space.sm,
  },
  /// Wordmark — rendered in the display font so the brand voice IS the
  /// type. Swap for an Image source when the Figma logo export lands.
  wordmark: {
    fontFamily: AmbitFont.display,
    fontSize: 26,
    color: Brand.inkPrimary,
    letterSpacing: 0.5,
  },
  subBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Space.lg,
    paddingBottom: Space.md,
  },
  campusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Brand.surface1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radii.pill,
  },
  campusLabel: {
    ...TypeScale.title,
    fontSize: 14,
    color: Brand.inkPrimary,
  },
  campusRadius: {
    ...TypeScale.helper,
    color: Brand.inkMuted,
  },
  // Context strip -----------------------------------------------
  context: {
    ...TypeScale.input,
    color: Brand.inkMuted,
    paddingHorizontal: Space.lg,
    marginBottom: Space.md,
  },

  // Scroll content ---------------------------------------------
  scroll: {
    paddingHorizontal: Space.lg,
    gap: Space.lg,
  },

  // Card --------------------------------------------------------
  card: {
    backgroundColor: Brand.canvas,
    borderRadius: Radii.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Brand.surface2,
  },
  hero: {
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroInitials: {
    fontFamily: AmbitFont.display,
    // One-off display size — the hero needs a single dominant glyph and
    // none of the TypeScale tokens fit. Treated as a card-level moment.
    fontSize: 56,
    color: 'rgba(255, 255, 255, 0.85)',
    letterSpacing: 2,
  },
  cardBody: {
    padding: 20,
    gap: 12,
  },
  cardTitle: {
    // Display headline at card scale — between TypeScale.title (16) and
    // TypeScale.h1 (30). One-off but consistent within the card family.
    fontFamily: AmbitFont.display,
    fontSize: 24,
    color: Brand.inkPrimary,
    lineHeight: 30,
  },

  // Owner row ---------------------------------------------------
  ownerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: Radii.full,
    backgroundColor: Brand.seekerSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: AmbitFont.body,
    fontSize: 12,
    fontWeight: '700',
    color: Brand.seekerInk,
  },
  ownerMeta: {
    ...TypeScale.helper,
    color: Brand.inkBody,
    flex: 1,
  },
  ownerDot: { color: Brand.inkMuted },

  // Chips -------------------------------------------------------
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm },

  // CTA ---------------------------------------------------------
  cta: { marginTop: Space.xs },
});
