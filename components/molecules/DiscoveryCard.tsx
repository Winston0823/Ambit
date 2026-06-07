import React, { useLayoutEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import {
  AppStoreLogo,
  GithubLogo,
  Globe,
  PaperPlaneTilt,
  type IconProps,
} from 'phosphor-react-native';
import * as Haptics from 'expo-haptics';
import {
  Brand,
  AmbitFont,
  Radii,
} from '../../constants/theme';
import type { DiscoveryCardData, PortfolioItem } from '../../data/mock';
import { CAMPUSES } from '../../data/mock';
import { HardShadow } from '../atoms';

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
  /// The swipe deck handles reach via its action row, so it hides the card's
  /// own floating button. Other contexts (saved preview) keep it (default).
  showReachButton?: boolean;
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
  showReachButton = true,
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

  // Seeker cards are a vertical 2-page pager: screen 1 = overview (the
  // photo card), screen 2 = portfolio highlights. We measure the card
  // height so each page snaps to exactly one viewport. The deck's
  // PanResponder only claims horizontal pans, so vertical drags fall
  // through to this ScrollView. Project cards stay single-page.
  const [cardH, setCardH] = useState(0);
  const [page, setPage] = useState(0);

  return (
    <Animated.View
      style={[
        styles.cardOuter,
        {
          opacity: cardOpacity,
          transform: [{ translateY: cardTranslateY }],
        },
      ]}
    >
      <HardShadow radius={22} offset={7} style={styles.hsFill}>
      <View
        style={styles.card}
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          if (h > 0 && Math.abs(h - cardH) > 0.5) setCardH(h);
        }}
      >
      {card.kind === 'seeker' ? (
        <>
          <ScrollView
            style={StyleSheet.absoluteFill}
            pagingEnabled
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={(e) => {
              if (cardH <= 0) return;
              const i = Math.round(e.nativeEvent.contentOffset.y / cardH);
              if (i !== page) setPage(i);
            }}
          >
            <View style={{ height: cardH }}>
              <SeekerContent
                card={card}
                matchedSkills={matchedSkills}
                onPortfolioPress={onPortfolioPress}
                activePortfolioId={activePortfolioId}
              />
            </View>
            <View style={{ height: cardH }}>
              <PortfolioHighlights
                card={card}
                onPortfolioPress={onPortfolioPress}
              />
            </View>
          </ScrollView>
          {cardH > 0 && <PageDots count={2} index={page} />}
        </>
      ) : (
        <ProjectContent card={card} matchedSkills={matchedSkills} />
      )}

      {showReachButton && (
        <ReachOutCircle
          firstName={firstName}
          onPress={() => onReachOut?.(card)}
        />
      )}
      </View>
      </HardShadow>
    </Animated.View>
  );
}

// ─── Page dots (vertical depth indicator) ──────────────────────────────────
// Sits on the right edge, vertically centered. Active page is a taller,
// brighter pill. Non-interactive — purely a discoverability cue.

function PageDots({ count, index }: { count: number; index: number }) {
  return (
    <View style={styles.dots} pointerEvents="none">
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={[styles.dot, i === index && styles.dotOn]} />
      ))}
    </View>
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
            <PaperPlaneTilt size={20} color={Brand.actionInk} weight="fill" />
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
        'rgba(0, 0, 0, 0.00)',
        'rgba(0, 0, 0, 0.05)',
        'rgba(0, 0, 0, 0.55)',
        'rgba(0, 0, 0, 1)',
      ]}
      locations={[0, 0.4, 0.66, 1]}
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

// ─── Portfolio-highlights mini-tile ───────────────────────────────────────
// Teaser on screen 1 for the featured portfolio piece; doubles as the cue to
// swipe up for the full Portfolio Highlights screen.

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
        {item.imageUri ? (
          <Image source={{ uri: item.imageUri }} style={styles.shipCover} resizeMode="cover" />
        ) : (
          <LinearGradient
            colors={item.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.shipCover}
          >
            <View style={styles.shipCoverOutline} pointerEvents="none" />
          </LinearGradient>
        )}
        <View style={styles.shipBody}>
          <Text style={styles.shipEyebrow} numberOfLines={1}>PORTFOLIO HIGHLIGHTS</Text>
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
      <Text style={styles.vibeText} numberOfLines={2}>{text}</Text>
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
  if (sharedCount > 0) badgeParts.push(`${sharedCount} shared`);
  if (campus) badgeParts.push(campus.name.toUpperCase());
  const badgeText = badgeParts.join(' · ');

  // Eyebrow — built only from data we actually have (major / campus / grad
  // year). Anything missing is simply omitted; no fabricated "Computer
  // Science '26" for everyone.
  const eyebrowText = [
    card.major?.toUpperCase(),
    campus?.name.toUpperCase(),
    card.gradYear ? `’${card.gradYear.replace(/^’/, '')}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

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
        <Text style={styles.name} numberOfLines={1}>{card.name.trim() || 'Someone on Ambit'}</Text>
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
  if (sharedCount > 0) badgeParts.push(`${sharedCount} shared`);
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
        {card.rolesSought && card.rolesSought.length > 0 && (
          <View style={styles.rolesRow}>
            {card.rolesSought.slice(0, 3).map((r) => (
              <View key={r} style={styles.roleChip}>
                <Text style={styles.roleChipText}>{r}</Text>
              </View>
            ))}
          </View>
        )}
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

// ─── Portfolio Highlights (screen 2) ───────────────────────────────────────
// The swipe-up deep dive: same identity header as screen 1 (eyebrow + big
// name), then the candidate's work as thumbnail + title + caption rows, and
// optional external links as icon buttons. Reach-out + page dots float on
// top from the parent, so this screen owns no chrome of its own.

interface PortfolioHighlightsProps {
  card: Extract<DiscoveryCardData, { kind: 'seeker' }>;
  onPortfolioPress?: (item: PortfolioItem) => void;
}

function PortfolioHighlights({ card, onPortfolioPress }: PortfolioHighlightsProps) {
  const campus = CAMPUSES.find((c) => c.id === card.campusId);
  const eyebrowText = [
    card.major?.toUpperCase(),
    campus?.name.toUpperCase(),
    card.gradYear ? `’${card.gradYear.replace(/^’/, '')}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const links = card.links;
  const hasLinks = !!(links && (links.github || links.site || links.appStore));

  return (
    <View style={styles.page2}>
      <View style={styles.page2Pad}>
        {eyebrowText !== '' && (
          <Text style={styles.eyebrow} numberOfLines={1}>{eyebrowText}</Text>
        )}
        <Text style={[styles.name, styles.page2Name]} numberOfLines={1}>{card.name}</Text>

        <Text style={styles.hlSection}>PORTFOLIO HIGHLIGHTS</Text>
        {card.portfolio.slice(0, 3).map((item) => (
          <HighlightRow
            key={item.id}
            item={item}
            onPress={() => onPortfolioPress?.(item)}
          />
        ))}

        {hasLinks && (
          <>
            <Text style={styles.hlSection}>LINKS</Text>
            <View style={styles.linkRow}>
              {links!.github && <LinkIcon Icon={GithubLogo} url={links!.github} label="GitHub" />}
              {links!.site && <LinkIcon Icon={Globe} url={links!.site} label="Website" />}
              {links!.appStore && <LinkIcon Icon={AppStoreLogo} url={links!.appStore} label="App Store" />}
            </View>
          </>
        )}
      </View>
    </View>
  );
}

function HighlightRow({
  item,
  onPress,
}: {
  item: PortfolioItem;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.hlRow, pressed && { opacity: 0.78 }]}
      accessibilityRole="button"
      accessibilityLabel={`Open ${item.title}`}
    >
      {item.imageUri ? (
        <Image source={{ uri: item.imageUri }} style={styles.hlThumb} resizeMode="cover" />
      ) : (
        <LinearGradient
          colors={item.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hlThumb}
        />
      )}
      <View style={styles.hlMeta}>
        <Text style={styles.hlTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.hlCap} numberOfLines={2}>{item.description}</Text>
      </View>
    </Pressable>
  );
}

function LinkIcon({
  Icon,
  url,
  label,
}: {
  Icon: React.ComponentType<IconProps>;
  url: string;
  label: string;
}) {
  return (
    <Pressable
      onPress={() => Linking.openURL(url).catch(() => {})}
      style={({ pressed }) => [styles.linkIcon, pressed && { opacity: 0.7 }]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Icon size={20} color="#F5E9D8" weight="regular" />
    </Pressable>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Card frame — the H design uses a very dark backdrop behind the photo
  // (visible if the photo failed to load or is transparent at edges).
  cardOuter: { flex: 1 },
  hsFill: { flex: 1 },
  card: {
    flex: 1,
    backgroundColor: '#2A1A0C',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: Brand.actionInk,
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
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    paddingLeft: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Brand.sage,
  },
  badgeText: {
    fontFamily: AmbitFont.body,
    fontSize: 11,
    fontWeight: '600',
    color: '#3A332A',
    letterSpacing: 0.2,
  },

  // ── Bottom content stack ───────────────────────────────────────────────
  stack: {
    position: 'absolute',
    left: 22,
    right: 22,
    bottom: 22,
    // Reserve the bottom-right gutter so content never slides under the
    // floating reach-out button + its label.
    paddingRight: 72,
    gap: 16,
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
    // Nudge the name up a touch, tightening it toward the eyebrow and
    // opening room for the quote glyph to drop down onto the blurb.
    marginTop: -8,
  },

  // ── Vibe block (italic body + decorative glyph behind) ─────────────────
  vibeBlock: {
    position: 'relative',
    paddingTop: 4,
    marginTop: -2,
  },
  vibeGlyph: {
    position: 'absolute',
    // Dropped from -54 → -40 so the glyph sits lower and overlaps the start
    // of the vibe blurb instead of floating up by the name.
    top: -40,
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

  // ── Role pills — open positions (above project title) ──────────────────
  rolesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 2,
  },
  roleChip: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(212, 180, 144, 0.28)',
    borderWidth: 1,
    borderColor: 'rgba(212, 180, 144, 0.55)',
  },
  roleChipText: {
    fontFamily: AmbitFont.body,
    fontSize: 10.5,
    fontWeight: '600',
    color: '#F5E9D8',
    letterSpacing: 0.3,
  },

  // ── Skill chips row ────────────────────────────────────────────────────
  skillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  // Modern frosted pills — no border. Matched skills get a warm-tan wash,
  // the rest a neutral frosted white; both read on the dark scrim.
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  chipMatched: {
    backgroundColor: 'rgba(201, 164, 122, 0.34)',
  },
  chipText: {
    fontFamily: AmbitFont.body,
    fontSize: 11.5,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.1,
  },
  chipTextMatched: {
    color: '#FFFFFF',
  },

  // ── Shipping mini-tile ─────────────────────────────────────────────────
  // Frosted-white portfolio teaser — soft, borderless, on the dark scrim.
  shipTile: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingLeft: 12,
    paddingRight: 16,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    alignSelf: 'flex-start',
    maxWidth: '80%',
  },
  shipTileActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.24)',
  },
  shipCover: {
    width: 34,
    height: 34,
    borderRadius: 9,
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
    color: 'rgba(255, 255, 255, 0.66)',
    letterSpacing: 1.5,
  },
  shipTitle: {
    fontFamily: AmbitFont.display,
    fontSize: 14,
    color: '#FFFFFF',
    letterSpacing: -0.1,
    marginTop: 1,
  },

  // ── Portfolio Highlights (screen 2) ────────────────────────────────────
  page2: {
    flex: 1,
    backgroundColor: '#000000',
  },
  // Screen 1's name carries marginTop:-8 (it tucks under the eyebrow over
  // the photo). Screen 2 has no stack gap, so override to a positive margin
  // so the name clears the eyebrow instead of colliding with it.
  page2Name: {
    marginTop: 8,
  },
  page2Pad: {
    flex: 1,
    paddingTop: 32,
    paddingHorizontal: 24,
    // leave room at the bottom so the last row / links clear the floating
    // reach-out button + its label.
    paddingBottom: 112,
  },
  hlSection: {
    fontFamily: AmbitFont.body,
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(245, 233, 216, 0.6)',
    letterSpacing: 1.8,
    marginTop: 20,
    marginBottom: 12,
  },
  hlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  hlThumb: {
    width: 78,
    height: 78,
    borderRadius: 12,
    backgroundColor: 'rgba(245, 233, 216, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245, 233, 216, 0.14)',
  },
  hlMeta: {
    flex: 1,
    minWidth: 0,
  },
  hlTitle: {
    fontFamily: AmbitFont.display,
    fontSize: 17,
    color: '#F5E9D8',
    letterSpacing: -0.2,
  },
  hlCap: {
    fontFamily: AmbitFont.body,
    fontSize: 12,
    lineHeight: 17,
    color: 'rgba(245, 233, 216, 0.82)',
    marginTop: 4,
  },
  linkRow: {
    flexDirection: 'row',
    gap: 12,
  },
  linkIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(245, 233, 216, 0.32)',
    backgroundColor: 'rgba(245, 233, 216, 0.07)',
  },

  // ── Page dots (vertical depth indicator, right edge) ───────────────────
  dots: {
    position: 'absolute',
    right: 10,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    zIndex: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(245, 233, 216, 0.4)',
  },
  dotOn: {
    height: 16,
    backgroundColor: '#F5E9D8',
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
    borderWidth: 1.6,
    borderColor: Brand.actionInk,
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
    backgroundColor: Brand.action, // signature teal — pops on the dark photo
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
