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
      {/* Photo hero — full-width band. Hinge-style: the person leads, the
          name + campus float on a dark gradient scrim at the bottom-left.
          When photoUri is missing, fall back to a warm gradient with the
          name initial as the placeholder visual. */}
      <View style={styles.heroBand}>
        {card.photoUri ? (
          <Image source={{ uri: card.photoUri }} style={styles.heroImg} />
        ) : (
          <LinearGradient
            colors={[Brand.primary, Brand.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroImg}
          >
            <Text style={styles.heroInitial}>{initial}</Text>
          </LinearGradient>
        )}
        {/* Dark scrim makes the overlaid name readable over any photo */}
        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.55)']}
          style={styles.heroScrim}
          pointerEvents="none"
        />
        <View style={styles.heroTextBlock}>
          <Text style={styles.heroName} numberOfLines={1}>{card.name}</Text>
          {campus && (
            <View style={styles.heroCampusRow}>
              <MapPin size={13} color="rgba(255,255,255,0.92)" weight="fill" />
              <Text style={styles.heroCampus} numberOfLines={1}>{campus.name}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Body — padded; sections breathe at 28pt apart */}
      <View style={styles.body}>
        {card.vibeBlurb !== '' && (
          <View>
            <Text style={styles.promptLabel}>IN THEIR WORDS</Text>
            <SpeechBubble color={Brand.seekerSurface} tailAnchor="top-left" tailOffset={20}>
              <Text style={styles.vibePrompt}>{card.vibeBlurb}</Text>
            </SpeechBubble>
          </View>
        )}

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
      </View>
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
    backgroundColor: Brand.cardCream,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Brand.borderSoft,
    overflow: 'hidden',
  },
  cardContent: {
    // No padding — sections manage their own. The photo hero must bleed
    // edge-to-edge while the body below gets standard padding.
    paddingBottom: Space.lg,
  },

  // ── Photo hero (Tier 1 Hinge-aligned) ───────────────────────────────────
  heroBand: {
    width: '100%',
    height: 320,
    position: 'relative',
    backgroundColor: Brand.seekerSurface,
  },
  heroImg: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroInitial: {
    fontFamily: AmbitFont.display,
    fontSize: 120,
    color: 'rgba(255, 255, 255, 0.92)',
    letterSpacing: 2,
  },
  heroScrim: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    height: 140,
  },
  heroTextBlock: {
    position: 'absolute',
    left: Space.lg, right: Space.lg, bottom: 18,
  },
  heroName: {
    fontFamily: AmbitFont.display,
    fontSize: 32,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  heroCampusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  heroCampus: {
    fontFamily: AmbitFont.body,
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.92)',
    fontWeight: '500',
  },

  // ── Body (everything below the photo hero) ──────────────────────────────
  body: {
    paddingHorizontal: Space.lg,
    paddingTop: Space.lg + 4,
    gap: 28,
  },

  // ── Hinge-style prompt label + display-serif answer ─────────────────────
  promptLabel: {
    fontFamily: AmbitFont.body,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.6,
    color: Brand.accent,
    marginBottom: 12,
  },
  vibePrompt: {
    fontFamily: AmbitFont.display, // Zodiak Bold — the prompt voice
    fontSize: 20,
    color: Brand.seekerInk,
    lineHeight: 28,
  },

  // ── Shared ──────────────────────────────────────────────────────────────
  section: {
    gap: 12,
  },
  sectionLabel: {
    fontFamily: AmbitFont.body,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: Brand.inkLabel,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  portfolioRow: {
    gap: 18,
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
