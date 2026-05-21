import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MapPin, Sparkle } from 'phosphor-react-native';
import { Chip } from '../atoms';
import {
  Brand,
  AmbitFont,
  Radii,
  Space,
  TypeScale,
} from '../../constants/theme';
import type { DiscoveryCardData } from '../../data/mock';
import { CAMPUSES } from '../../data/mock';

interface Props {
  card: DiscoveryCardData;
}

/// The visual half of a Discovery card. Pure render — no gestures, no state.
/// Two variants via discriminated union on `kind`:
///
///   - 'seeker'  → Owner sees this. Name, skills, portfolio highlight.
///   - 'project' → Seeker sees this. Pitch, owner, why-matched, skills sought.
///
/// Layout principle: the hero band carries the card's identity (gradient for
/// projects, warm seekerSurface for seekers). The body carries the meaning.
/// Both variants share the same outer card chrome so swipe mechanics never
/// need to special-case dimensions.
export function DiscoveryCard({ card }: Props) {
  return card.kind === 'seeker' ? <SeekerVariant card={card} /> : <ProjectVariant card={card} />;
}

// ─── Seeker variant (owner view) ───────────────────────────────────────────

function SeekerVariant({ card }: { card: Extract<DiscoveryCardData, { kind: 'seeker' }> }) {
  const initial = card.name[0]?.toUpperCase() ?? '?';
  const campus = CAMPUSES.find((c) => c.id === card.campusId);

  return (
    <View style={styles.card}>
      {/* Hero: warm sand band with the seeker's avatar dropped in. The card
          stays calm — the avatar isn't huge; the meaning is in the body. */}
      <View style={[styles.hero, { backgroundColor: Brand.seekerSurface }]}>
        <View style={styles.avatarLarge}>
          {card.photoUri ? (
            <Image source={{ uri: card.photoUri }} style={styles.avatarLargeImg} />
          ) : (
            <Text style={styles.avatarLargeText}>{initial}</Text>
          )}
        </View>
      </View>

      <View style={styles.body}>
        <Text style={styles.title}>{card.name}</Text>

        {campus && (
          <View style={styles.metaRow}>
            <MapPin size={14} color={Brand.inkMuted} weight="fill" />
            <Text style={styles.metaText}>{campus.name}</Text>
          </View>
        )}

        <Text style={styles.vibe}>{card.vibeBlurb}</Text>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>SKILLS</Text>
          <View style={styles.chipRow}>
            {card.skills.map((s) => (
              <Chip key={s} label={s} selected={false} />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>PORTFOLIO HIGHLIGHT</Text>
          <Text style={styles.portfolio}>{card.portfolioHighlight}</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Project variant (seeker view) ─────────────────────────────────────────

function ProjectVariant({ card }: { card: Extract<DiscoveryCardData, { kind: 'project' }> }) {
  const initials = card.title
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
  const campus = CAMPUSES.find((c) => c.id === card.ownerCampusId);

  return (
    <View style={styles.card}>
      <LinearGradient
        colors={card.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <Text style={styles.heroInitials}>{initials}</Text>
      </LinearGradient>

      <View style={styles.body}>
        <Text style={styles.title}>{card.title}</Text>

        <Text style={styles.pitch}>{card.pitch}</Text>

        {/* Owner row — name + campus dot + a small avatar */}
        <View style={styles.ownerRow}>
          <View style={styles.avatarSmall}>
            <Text style={styles.avatarSmallText}>{card.ownerName[0]}</Text>
          </View>
          <Text style={styles.ownerText} numberOfLines={1}>
            {card.ownerName}
            {campus && <Text style={styles.ownerDot}>  ·  {campus.name}</Text>}
          </Text>
        </View>

        {/* Why-matched — placeholder for the real matching algorithm. The
            sparkle icon flags it as a machine signal, not a user-written claim. */}
        <View style={styles.whyRow}>
          <Sparkle size={14} color={Brand.accent} weight="fill" />
          <Text style={styles.whyText}>{card.whyMatched}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>LOOKING FOR</Text>
          <View style={styles.chipRow}>
            {card.skillsSought.map((s) => (
              <Chip key={s} label={s} selected={false} />
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: Brand.canvas,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Brand.surface2,
    overflow: 'hidden',
  },

  // Hero band — fixed share of card height so layout doesn't shift between
  // variants. ~28% of card on a 600pt-tall deck = ~170pt hero.
  hero: {
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroInitials: {
    fontFamily: AmbitFont.display,
    fontSize: 64,
    color: 'rgba(255, 255, 255, 0.88)',
    letterSpacing: 2,
  },

  // Body
  body: {
    flex: 1,
    padding: Space.lg,
    gap: 14,
  },
  title: {
    fontFamily: AmbitFont.display,
    fontSize: 26,
    color: Brand.inkPrimary,
    lineHeight: 32,
  },
  pitch: {
    ...TypeScale.lead,
    color: Brand.inkBody,
    lineHeight: 23,
  },
  vibe: {
    ...TypeScale.lead,
    color: Brand.inkBody,
    fontStyle: 'italic',
    lineHeight: 23,
  },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: -8,
  },
  metaText: {
    ...TypeScale.helper,
    color: Brand.inkMuted,
  },

  // Owner row inside project variant
  ownerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarSmall: {
    width: 24,
    height: 24,
    borderRadius: Radii.full,
    backgroundColor: Brand.seekerSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSmallText: {
    fontFamily: AmbitFont.body,
    fontSize: 12,
    fontWeight: '700',
    color: Brand.seekerInk,
  },
  ownerText: {
    ...TypeScale.helper,
    color: Brand.inkBody,
    flex: 1,
  },
  ownerDot: { color: Brand.inkMuted },

  // Large avatar inside seeker variant hero
  avatarLarge: {
    width: 96,
    height: 96,
    borderRadius: Radii.full,
    backgroundColor: Brand.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: Brand.canvas,
    overflow: 'hidden',
  },
  avatarLargeImg: {
    width: '100%',
    height: '100%',
  },
  avatarLargeText: {
    fontFamily: AmbitFont.display,
    fontSize: 40,
    color: Brand.seekerInk,
  },

  // Why-matched
  whyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Brand.seekerSurface,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: Radii.sm,
    alignSelf: 'flex-start',
  },
  whyText: {
    ...TypeScale.helper,
    color: Brand.seekerInk,
    fontWeight: '600',
  },

  // Section (skills, portfolio)
  section: {
    gap: 8,
  },
  sectionLabel: {
    ...TypeScale.labelSm,
    color: Brand.inkLabel,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Space.sm,
  },
  portfolio: {
    ...TypeScale.body,
    color: Brand.inkBody,
    lineHeight: 21,
  },
});
