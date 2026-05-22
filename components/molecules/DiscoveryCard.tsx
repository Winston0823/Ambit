import React from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MapPin, Sparkle } from 'phosphor-react-native';
import { Chip } from '../atoms';
import { PortfolioBubble } from './PortfolioBubble';
import { SpeechBubble } from './SpeechBubble';
import {
  Brand,
  AmbitFont,
  Radii,
  Space,
  TypeScale,
} from '../../constants/theme';
import type { DiscoveryCardData, PortfolioItem } from '../../data/mock';
import { CAMPUSES } from '../../data/mock';

interface Props {
  card: DiscoveryCardData;
  /// Project skills the seeker's chips should be highlighted against. Only
  /// meaningful for the 'seeker' variant; passing it on a project card is a
  /// no-op. Empty array or undefined = no highlighting.
  matchedSkills?: string[];
  /// Called when a portfolio bubble is tapped. Parent owns the modal state
  /// so the swipe deck can pause its PanResponder while the modal is open.
  onPortfolioPress?: (item: PortfolioItem) => void;
  /// ID of the portfolio item whose modal is currently visible — that bubble
  /// gets a faint brand ring so the user keeps spatial context.
  activePortfolioId?: string | null;
}

/// The visual half of a Discovery card. Pure render — no gestures, no state.
/// Two variants via discriminated union on `kind`:
///
///   - 'seeker'  → Owner sees this. Avatar+name top row, speech-bubble vibe,
///                 highlighted skills, portfolio bubble row.
///   - 'project' → Seeker sees this. Gradient hero + pitch + why-matched
///                 (unchanged from the original layout).
export function DiscoveryCard({
  card,
  matchedSkills,
  onPortfolioPress,
  activePortfolioId,
}: Props) {
  return card.kind === 'seeker' ? (
    <SeekerVariant
      card={card}
      matchedSkills={matchedSkills}
      onPortfolioPress={onPortfolioPress}
      activePortfolioId={activePortfolioId}
    />
  ) : (
    <ProjectVariant card={card} />
  );
}

// ─── Seeker variant (owner's view of seekers) ──────────────────────────────

interface SeekerProps {
  card: Extract<DiscoveryCardData, { kind: 'seeker' }>;
  matchedSkills?: string[];
  onPortfolioPress?: (item: PortfolioItem) => void;
  activePortfolioId?: string | null;
}

function SeekerVariant({
  card,
  matchedSkills,
  onPortfolioPress,
  activePortfolioId,
}: SeekerProps) {
  const initial = card.name[0]?.toUpperCase() ?? '?';
  const campus = CAMPUSES.find((c) => c.id === card.campusId);
  const matchedSet = new Set((matchedSkills ?? []).map((s) => s.toLowerCase()));
  const isMatched = (skill: string) => matchedSet.has(skill.toLowerCase());

  return (
    <ScrollView
      style={styles.card}
      contentContainerStyle={styles.cardContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Top row: avatar (left) + name + campus stack */}
      <View style={styles.topRow}>
        <View style={styles.avatar}>
          {card.photoUri ? (
            <Image source={{ uri: card.photoUri }} style={styles.avatarImg} />
          ) : (
            <Text style={styles.avatarInitial}>{initial}</Text>
          )}
        </View>
        <View style={styles.nameCol}>
          <Text style={styles.name} numberOfLines={1}>
            {card.name}
          </Text>
          {campus && (
            <View style={styles.campusRow}>
              <MapPin size={12} color={Brand.inkMuted} weight="fill" />
              <Text style={styles.campusText} numberOfLines={1}>
                {campus.name}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Vibe blurb — speech bubble with tail pointing up toward the avatar */}
      {card.vibeBlurb !== '' && (
        <SpeechBubble color={Brand.seekerSurface} tailAnchor="top-left" tailOffset={20}>
          <Text style={styles.vibe}>{card.vibeBlurb}</Text>
        </SpeechBubble>
      )}

      {/* Skills — chips highlighted when they match the project's needs */}
      {card.skills.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>SKILLS</Text>
          <View style={styles.chipRow}>
            {card.skills.map((s) => (
              <Chip key={s} label={s} selected={isMatched(s)} />
            ))}
          </View>
        </View>
      )}

      {/* Portfolio — horizontal row of bubble + title-below. Hidden when empty. */}
      {card.portfolio.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>PORTFOLIO</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.portfolioRow}
          >
            {card.portfolio.map((item) => (
              <PortfolioBubble
                key={item.id}
                item={item}
                onPress={() => onPortfolioPress?.(item)}
                active={activePortfolioId === item.id}
              />
            ))}
          </ScrollView>
        </View>
      )}
    </ScrollView>
  );
}

// ─── Project variant (seeker's view of projects) — unchanged from prior pass

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
        style={styles.projectHero}
      >
        <Text style={styles.heroInitials}>{initials}</Text>
      </LinearGradient>

      <View style={styles.projectBody}>
        <Text style={styles.projectTitle}>{card.title}</Text>
        <Text style={styles.pitch}>{card.pitch}</Text>

        <View style={styles.ownerRow}>
          <View style={styles.ownerAvatar}>
            <Text style={styles.ownerAvatarText}>{card.ownerName[0]}</Text>
          </View>
          <Text style={styles.ownerText} numberOfLines={1}>
            {card.ownerName}
            {campus && <Text style={styles.ownerDot}>  ·  {campus.name}</Text>}
          </Text>
        </View>

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
  cardContent: {
    padding: Space.lg,
    gap: Space.lg,
  },

  // ── Seeker variant ──────────────────────────────────────────────────────
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: Radii.full,
    backgroundColor: Brand.seekerSurface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarInitial: {
    fontFamily: AmbitFont.display,
    fontSize: 26,
    color: Brand.seekerInk,
  },
  nameCol: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontFamily: AmbitFont.display,
    fontSize: 22,
    color: Brand.inkPrimary,
    lineHeight: 28,
  },
  campusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  campusText: {
    ...TypeScale.helper,
    color: Brand.inkMuted,
  },
  vibe: {
    fontFamily: AmbitFont.body,
    fontSize: 15,
    fontStyle: 'italic',
    color: Brand.seekerInk,
    lineHeight: 21,
  },

  // ── Shared ──────────────────────────────────────────────────────────────
  section: {
    gap: 10,
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
  portfolioRow: {
    gap: 14,
    paddingRight: Space.lg, // breathing room at the end of the scroll
  },

  // ── Project variant (unchanged styling) ─────────────────────────────────
  projectHero: {
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
  projectBody: {
    flex: 1,
    padding: Space.lg,
    gap: 14,
  },
  projectTitle: {
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
  ownerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  ownerAvatar: {
    width: 24,
    height: 24,
    borderRadius: Radii.full,
    backgroundColor: Brand.seekerSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ownerAvatarText: {
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
});
