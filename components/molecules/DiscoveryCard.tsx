import React, { useLayoutEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { PaperPlaneTilt } from 'phosphor-react-native';
import * as Haptics from 'expo-haptics';
import {
  Brand,
  AmbitFont,
  Radii,
} from '../../constants/theme';
import type { DiscoveryCardData, PortfolioItem } from '../../data/mock';
import { CAMPUSES } from '../../data/mock';

interface Props {
  card: DiscoveryCardData;
  /// Skills the viewer cares about (their project's skill list when an
  /// owner is viewing seekers, the viewer's own skill list when a seeker
  /// is viewing projects). Drives matched count + which skill chips are
  /// tinted terracotta on the card.
  matchedSkills?: string[];
  onPortfolioPress?: (item: PortfolioItem) => void;
  activePortfolioId?: string | null;
  onReachOut?: (card: DiscoveryCardData) => void;
}

/// Discovery card — H-overlay redesign. Photo fills the card edge-to-edge,
/// dark vertical scrim at the bottom for legibility, identity + vibe +
/// skills + portfolio mini-tile stack from the bottom up. Reach Out is a
/// circular warm-tan liquid-glass button in the bottom-right corner.
///
/// Everything fits in one viewport — no scroll. SwipeDeck still wraps
/// this with the PanResponder for swipe gestures.
export function DiscoveryCard({
  card,
  matchedSkills,
  onPortfolioPress,
  activePortfolioId,
  onReachOut,
}: Props) {
  const firstName = card.kind === 'seeker'
    ? card.name.split(' ')[0]
    : card.ownerName.split(' ')[0];

  // Entry fade — masks any layout flicker when SwipeDeck mounts a new card.
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardTranslateY = useRef(new Animated.Value(8)).current;
  useLayoutEffect(() => {
    cardOpacity.setValue(0);
    cardTranslateY.setValue(8);
    Animated.parallel([
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 240,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
        useNativeDriver: true,
      }),
      Animated.timing(cardTranslateY, {
        toValue: 0,
        duration: 280,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
        useNativeDriver: true,
      }),
    ]).start();
  }, [card.id, cardOpacity, cardTranslateY]);

  return (
    <Animated.View
      style={[
        styles.card,
        {
          opacity: cardOpacity,
          transform: [{ translateY: cardTranslateY }],
        },
      ]}
    >
      {card.kind === 'seeker' ? (
        <SeekerContent
          card={card}
          matchedSkills={matchedSkills}
          onPortfolioPress={onPortfolioPress}
          activePortfolioId={activePortfolioId}
        />
      ) : (
        <ProjectContent card={card} matchedSkills={matchedSkills} />
      )}

      <ReachOutCircle
        firstName={firstName}
        onPress={() => onReachOut?.(card)}
      />
    </Animated.View>
  );
}

// ─── Reach Out circle ──────────────────────────────────────────────────────
// Warm-tan liquid-glass circle in the bottom-right. BlurView for the glass
// effect, tinted overlay for the warm-tan color, inset top-edge highlight.

function ReachOutCircle({
  firstName,
  onPress,
}: {
  firstName: string;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const press = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    onPress();
  };
  return (
    <View style={styles.reachWrap} pointerEvents="box-none">
      <Pressable
        onPress={press}
        onPressIn={() => Animated.spring(scale, {
          toValue: 0.94,
          friction: 8,
          tension: 220,
          useNativeDriver: true,
        }).start()}
        onPressOut={() => Animated.spring(scale, {
          toValue: 1,
          friction: 5,
          tension: 180,
          useNativeDriver: true,
        }).start()}
        accessibilityRole="button"
        accessibilityLabel={`Reach out to ${firstName}`}
      >
        <Animated.View style={[styles.reachContainer, { transform: [{ scale }] }]}>
          <BlurView intensity={36} tint="default" style={styles.reachBlur}>
            <View style={styles.reachTint} pointerEvents="none" />
            <View style={styles.reachTopHighlight} pointerEvents="none" />
            <PaperPlaneTilt size={20} color="#FFFFFF" weight="fill" />
          </BlurView>
        </Animated.View>
      </Pressable>
    </View>
  );
}

// ─── Photo backdrop ───────────────────────────────────────────────────────
// Full-bleed image filling the card. If photoUri is null, falls back to a
// warm tan→accent gradient placeholder (same approach as in Figma).

function PhotoBackdrop({
  uri,
  fallbackGradient,
  fallbackInitials,
}: {
  uri: string | null;
  fallbackGradient?: readonly [string, string];
  fallbackInitials?: string;
}) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={styles.photo}
        resizeMode="cover"
      />
    );
  }
  return (
    <LinearGradient
      colors={fallbackGradient ?? [Brand.primary, Brand.accent]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.photo}
    >
      {fallbackInitials && (
        <Text style={styles.photoFallbackInitials}>{fallbackInitials}</Text>
      )}
    </LinearGradient>
  );
}

// ─── Scrim ─────────────────────────────────────────────────────────────────
// Vertical top→bottom dark gradient. Transparent at top, near-opaque at
// bottom. Sits over the photo so the bottom content reads cleanly.

function Scrim() {
  return (
    <LinearGradient
      colors={[
        'rgba(26, 22, 18, 0.00)',
        'rgba(26, 22, 18, 0.05)',
        'rgba(26, 22, 18, 0.45)',
        'rgba(26, 22, 18, 0.88)',
      ]}
      locations={[0, 0.38, 0.62, 1]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.scrim}
      pointerEvents="none"
    />
  );
}

// ─── Top-right badge ──────────────────────────────────────────────────────

function MatchBadge({ text }: { text: string }) {
  return (
    <View style={styles.badge}>
      <View style={styles.badgeDot} />
      <Text style={styles.badgeText}>{text}</Text>
    </View>
  );
}

// ─── Skill chip ───────────────────────────────────────────────────────────

function SkillChip({
  label,
  matched,
}: {
  label: string;
  matched: boolean;
}) {
  return (
    <View style={[styles.chip, matched && styles.chipMatched]}>
      <Text
        style={[styles.chipText, matched && styles.chipTextMatched]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

// ─── Currently shipping mini-tile ─────────────────────────────────────────

function ShippingTile({
  item,
  active,
  onPress,
}: {
  item: PortfolioItem;
  active: boolean;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => Animated.spring(scale, {
        toValue: 0.97,
        friction: 8,
        tension: 220,
        useNativeDriver: true,
      }).start()}
      onPressOut={() => Animated.spring(scale, {
        toValue: 1,
        friction: 5,
        tension: 180,
        useNativeDriver: true,
      }).start()}
    >
      <Animated.View
        style={[
          styles.shipTile,
          active && styles.shipTileActive,
          { transform: [{ scale }] },
        ]}
      >
        <LinearGradient
          colors={item.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.shipCover}
        >
          <View style={styles.shipCoverOutline} pointerEvents="none" />
        </LinearGradient>
        <View style={styles.shipBody}>
          <Text style={styles.shipEyebrow}>CURRENTLY SHIPPING</Text>
          <Text style={styles.shipTitle} numberOfLines={1}>{item.title}</Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

// ─── Decorative quote glyph (behind vibe text) ────────────────────────────

function VibeBlock({ text }: { text: string }) {
  return (
    <View style={styles.vibeBlock}>
      <Text
        style={styles.vibeGlyph}
        allowFontScaling={false}
        numberOfLines={1}
        pointerEvents="none"
      >
        {'“'}
      </Text>
      <Text style={styles.vibeText}>{text}</Text>
    </View>
  );
}

// ─── Seeker content ────────────────────────────────────────────────────────

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
  const campus = CAMPUSES.find((c) => c.id === card.campusId);
  const matchedSet = new Set((matchedSkills ?? []).map((s) => s.toLowerCase()));
  const sharedCount = card.skills.filter((s) => matchedSet.has(s.toLowerCase())).length;
  const ordered = [...card.skills].sort((a, b) => {
    const am = matchedSet.has(a.toLowerCase()) ? 0 : 1;
    const bm = matchedSet.has(b.toLowerCase()) ? 0 : 1;
    return am - bm;
  });
  const featured = card.portfolio[0];

  // Top-right badge text — synthesized from match data
  const badgeParts: string[] = [];
  if (sharedCount > 0) badgeParts.push(`${sharedCount} SHARED`);
  if (campus) badgeParts.push(campus.name.toUpperCase());
  const badgeText = badgeParts.join(' · ');

  // Eyebrow — campus + role
  const eyebrowText = campus
    ? `COMPUTER SCIENCE · ${campus.name.toUpperCase()} ’${'26'}`
    : '';

  return (
    <>
      <PhotoBackdrop uri={card.photoUri} />
      <Scrim />

      {badgeText && (
        <View style={styles.badgePosition}>
          <MatchBadge text={badgeText} />
        </View>
      )}

      <View style={styles.stack}>
        {eyebrowText !== '' && (
          <Text style={styles.eyebrow} numberOfLines={1}>{eyebrowText}</Text>
        )}
        <Text style={styles.name} numberOfLines={1}>{card.name}</Text>
        {card.vibeBlurb !== '' && <VibeBlock text={card.vibeBlurb} />}
        <View style={styles.skillsRow}>
          {ordered.slice(0, 4).map((s) => (
            <SkillChip
              key={s}
              label={s}
              matched={matchedSet.has(s.toLowerCase())}
            />
          ))}
        </View>
        {featured && (
          <ShippingTile
            item={featured}
            active={activePortfolioId === featured.id}
            onPress={() => onPortfolioPress?.(featured)}
          />
        )}
      </View>
    </>
  );
}

// ─── Project content ───────────────────────────────────────────────────────

interface ProjectContentProps {
  card: Extract<DiscoveryCardData, { kind: 'project' }>;
  matchedSkills?: string[];
}

function ProjectContent({ card, matchedSkills }: ProjectContentProps) {
  const initials = card.title
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
  const campus = CAMPUSES.find((c) => c.id === card.ownerCampusId);
  const matchedSet = new Set((matchedSkills ?? []).map((s) => s.toLowerCase()));
  const sharedCount = card.skillsSought.filter((s) => matchedSet.has(s.toLowerCase())).length;
  const ordered = [...card.skillsSought].sort((a, b) => {
    const am = matchedSet.has(a.toLowerCase()) ? 0 : 1;
    const bm = matchedSet.has(b.toLowerCase()) ? 0 : 1;
    return am - bm;
  });

  const badgeParts: string[] = [];
  if (sharedCount > 0) badgeParts.push(`${sharedCount} SHARED`);
  if (campus) badgeParts.push(campus.name.toUpperCase());
  const badgeText = badgeParts.join(' · ');

  const eyebrowText = campus
    ? `BY ${card.ownerName.toUpperCase()} · ${campus.name.toUpperCase()}`
    : `BY ${card.ownerName.toUpperCase()}`;

  return (
    <>
      <PhotoBackdrop
        uri={card.ownerPhotoUri ?? null}
        fallbackGradient={card.gradient}
        fallbackInitials={initials}
      />
      <Scrim />

      {badgeText !== '' && (
        <View style={styles.badgePosition}>
          <MatchBadge text={badgeText} />
        </View>
      )}

      <View style={styles.stack}>
        <Text style={styles.eyebrow} numberOfLines={1}>{eyebrowText}</Text>
        <Text style={styles.name} numberOfLines={2}>{card.title}</Text>
        {card.pitch !== '' && <VibeBlock text={card.pitch} />}
        <View style={styles.skillsRow}>
          {ordered.slice(0, 4).map((s) => (
            <SkillChip
              key={s}
              label={s}
              matched={matchedSet.has(s.toLowerCase())}
            />
          ))}
        </View>
      </View>
    </>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Card frame — the H design uses a very dark backdrop behind the photo
  // (visible if the photo failed to load or is transparent at edges).
  card: {
    flex: 1,
    backgroundColor: '#2A1A0C',
    borderRadius: 22,
    overflow: 'hidden', // photo + scrim need to clip to the rounded corners
    position: 'relative',
  },

  // ── Photo (full-bleed) ─────────────────────────────────────────────────
  photo: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoFallbackInitials: {
    fontFamily: AmbitFont.display,
    fontSize: 96,
    color: 'rgba(255, 255, 255, 0.88)',
    letterSpacing: 2,
  },

  // ── Scrim (top→bottom dark gradient) ───────────────────────────────────
  scrim: {
    ...StyleSheet.absoluteFillObject,
  },

  // ── Badge (top-right) ──────────────────────────────────────────────────
  badgePosition: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 4,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 11,
    paddingVertical: 7,
    paddingLeft: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(245, 233, 216, 0.92)',
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Brand.sage,
  },
  badgeText: {
    fontFamily: AmbitFont.body,
    fontSize: 10,
    fontWeight: '700',
    color: Brand.seekerInk,
    letterSpacing: 1.6,
  },

  // ── Bottom content stack ───────────────────────────────────────────────
  stack: {
    position: 'absolute',
    left: 22,
    right: 22,
    bottom: 22,
    gap: 14,
    zIndex: 3,
  },
  eyebrow: {
    fontFamily: AmbitFont.body,
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(245, 233, 216, 0.7)',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },
  name: {
    fontFamily: AmbitFont.display,
    fontSize: 34,
    color: '#F5E9D8',
    letterSpacing: -0.6,
    lineHeight: 38,
  },

  // ── Vibe block (italic body + decorative glyph behind) ─────────────────
  vibeBlock: {
    position: 'relative',
    paddingTop: 4,
    marginTop: -2,
  },
  vibeGlyph: {
    position: 'absolute',
    top: -54,
    left: -14,
    width: 240,
    fontSize: 120,
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
    fontStyle: 'italic',
    color: 'rgba(232, 201, 160, 0.42)',
    letterSpacing: -2,
    includeFontPadding: false,
    zIndex: 0,
  },
  vibeText: {
    position: 'relative',
    zIndex: 1,
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
    fontStyle: 'italic',
    fontSize: 19,
    color: '#F5E9D8',
    lineHeight: 26,
    letterSpacing: -0.1,
  },

  // ── Skill chips row ────────────────────────────────────────────────────
  skillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(245, 233, 216, 0.16)',
    backgroundColor: 'rgba(245, 233, 216, 0.10)',
  },
  chipMatched: {
    borderColor: 'rgba(199, 111, 74, 0.55)',
    backgroundColor: 'rgba(199, 111, 74, 0.36)',
  },
  chipText: {
    fontFamily: AmbitFont.body,
    fontSize: 11.5,
    fontWeight: '600',
    color: 'rgba(245, 233, 216, 0.92)',
    letterSpacing: 0.1,
  },
  chipTextMatched: {
    color: '#FFE7D5',
  },

  // ── Shipping mini-tile ─────────────────────────────────────────────────
  shipTile: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 10,
    paddingRight: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 233, 216, 0.18)',
    backgroundColor: 'rgba(245, 233, 216, 0.10)',
    alignSelf: 'flex-start',
    maxWidth: '80%',
  },
  shipTileActive: {
    borderColor: Brand.accent,
  },
  shipCover: {
    width: 32,
    height: 32,
    borderRadius: 6,
    overflow: 'hidden',
  },
  shipCoverOutline: {
    position: 'absolute',
    top: 7,
    left: 7,
    right: 7,
    bottom: 7,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  shipBody: {
    flexShrink: 1,
  },
  shipEyebrow: {
    fontFamily: AmbitFont.body,
    fontSize: 8.5,
    fontWeight: '700',
    color: 'rgba(245, 233, 216, 0.6)',
    letterSpacing: 1.5,
  },
  shipTitle: {
    fontFamily: AmbitFont.display,
    fontSize: 14,
    color: '#F5E9D8',
    letterSpacing: -0.1,
    marginTop: 1,
  },

  // ── Reach Out circle (bottom-right liquid glass) ───────────────────────
  reachWrap: {
    position: 'absolute',
    bottom: 22,
    right: 22,
    zIndex: 5,
  },
  reachContainer: {
    width: 58,
    height: 58,
    borderRadius: 29,
    overflow: 'hidden',
    shadowColor: '#281810',
    shadowOpacity: 0.45,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
    borderWidth: 1,
    borderColor: Brand.glassEdge,
  },
  reachBlur: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  reachTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Brand.glassInk,
  },
  reachTopHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: Brand.glassHighlight,
  },
});
