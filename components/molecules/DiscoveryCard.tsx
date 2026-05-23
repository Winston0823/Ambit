import React from 'react';
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MapPin, PaperPlaneTilt, Sparkle } from 'phosphor-react-native';
import * as Haptics from 'expo-haptics';
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

const FOOTER_HEIGHT = 76; // pinned Reach Out footer

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
  /// Called when the user taps the pinned "Reach out" footer button. Parent
  /// opens the ReachOutComposer modal in response. Decoupled from the
  /// swipe-deck gestures, which now only handle horizontal pass/save.
  onReachOut?: (card: DiscoveryCardData) => void;
}

/// The visual half of a Discovery card. Pure render — no gestures, no state.
/// Two variants via discriminated union on `kind`:
///
///   - 'seeker'  → Owner sees this. Photo hero + speech-bubble vibe +
///                 highlighted skills + portfolio bubble row.
///   - 'project' → Seeker sees this. Gradient hero + pitch + why-matched.
///
/// Both variants share the card chrome: cream surface, rounded border,
/// scrollable body, and a pinned "Reach out" footer that opens the
/// composer modal. Variants render content only.
export function DiscoveryCard({
  card,
  matchedSkills,
  onPortfolioPress,
  activePortfolioId,
  onReachOut,
}: Props) {
  return (
    <View style={styles.card}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollPad}
        showsVerticalScrollIndicator={false}
      >
        {card.kind === 'seeker' ? (
          <SeekerContent
            card={card}
            matchedSkills={matchedSkills}
            onPortfolioPress={onPortfolioPress}
            activePortfolioId={activePortfolioId}
          />
        ) : (
          <ProjectContent card={card} />
        )}
      </ScrollView>

      <ReachOutFooter onPress={() => onReachOut?.(card)} />
    </View>
  );
}

// ─── Pinned footer with Reach Out button ──────────────────────────────────

function ReachOutFooter({ onPress }: { onPress: () => void }) {
  const press = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    onPress();
  };
  return (
    <View style={styles.footer} pointerEvents="box-none">
      {/* Soft fade above the button so scrolling content fades behind it
          instead of jamming against a hard edge */}
      <LinearGradient
        colors={['rgba(250, 246, 240, 0)', 'rgba(250, 246, 240, 0.98)']}
        style={styles.footerFade}
        pointerEvents="none"
      />
      <Pressable onPress={press} style={({ pressed }) => [styles.footerBtn, pressed && { opacity: 0.92 }]}>
        <PaperPlaneTilt size={18} color={Brand.inkOnBrand} weight="fill" />
        <Text style={styles.footerLabel}>Reach out</Text>
      </Pressable>
    </View>
  );
}

// ─── Seeker content (owner's view of seekers) ─────────────────────────────

interface SeekerContentProps {
  card: Extract<DiscoveryCardData, { kind: 'seeker' }>;
  matchedSkills?: string[];
  onPortfolioPress?: (item: PortfolioItem) => void;
  activePortfolioId?: string | null;
}

function SeekerContent({
  card,
  matchedSkills,
  onPortfolioPress,
  activePortfolioId,
}: SeekerContentProps) {
  const initial = card.name[0]?.toUpperCase() ?? '?';
  const campus = CAMPUSES.find((c) => c.id === card.campusId);
  const matchedSet = new Set((matchedSkills ?? []).map((s) => s.toLowerCase()));
  const isMatched = (skill: string) => matchedSet.has(skill.toLowerCase());

  return (
    <>
      {/* Photo hero — full-width band with name + campus on a dark scrim */}
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
    </>
  );
}

// ─── Project content (seeker's view of projects) ──────────────────────────

function ProjectContent({ card }: { card: Extract<DiscoveryCardData, { kind: 'project' }> }) {
  const initials = card.title
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
  const campus = CAMPUSES.find((c) => c.id === card.ownerCampusId);

  return (
    <>
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
    </>
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
    // Card is the positioning context for the absolute-pinned footer.
    position: 'relative',
  },
  scroll: { flex: 1 },
  scrollPad: {
    // Bottom padding clears the pinned footer so the last item never gets
    // hidden behind it.
    paddingBottom: FOOTER_HEIGHT + Space.lg,
  },

  // ── Pinned Reach Out footer ─────────────────────────────────────────────
  footer: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    paddingHorizontal: Space.lg,
    paddingBottom: 16,
    paddingTop: 12,
  },
  footerFade: {
    position: 'absolute',
    left: 0, right: 0, top: -28,
    height: 40,
  },
  footerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 52,
    backgroundColor: Brand.primary,
    borderRadius: Radii.md,
  },
  footerLabel: {
    fontFamily: AmbitFont.body,
    fontSize: 16,
    fontWeight: '600',
    color: Brand.inkOnBrand,
    letterSpacing: 0.2,
  },

  // ── Photo hero (seeker) ────────────────────────────────────────────────
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

  // ── Body (everything below the hero) ───────────────────────────────────
  body: {
    paddingHorizontal: Space.lg,
    paddingTop: Space.lg + 4,
    gap: 28,
  },

  // ── Hinge-style prompt label + display-serif answer ────────────────────
  promptLabel: {
    fontFamily: AmbitFont.body,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.6,
    color: Brand.accent,
    marginBottom: 12,
  },
  vibePrompt: {
    fontFamily: AmbitFont.display,
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
    paddingRight: Space.lg,
  },

  // ── Project variant ────────────────────────────────────────────────────
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
