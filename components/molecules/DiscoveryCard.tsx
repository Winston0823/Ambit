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
  ArrowClockwise,
  CaretUp,
  GithubLogo,
  Globe,
  Lightning,
  PaperPlaneTilt,
  type IconProps,
} from 'phosphor-react-native';
import * as Haptics from 'expo-haptics';
import {
  Brand,
  AmbitFont,
  Radii,
} from '../../constants/theme';
import type { DiscoveryCardData, PortfolioItem, SeekerLinks } from '../../data/mock';
import { responseTier } from '../../lib/responseRate';
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
  /// Render the reach button in a non-interactive, half-transparent preview
  /// state — used by the owner's project-edit Preview so the gutter is filled
  /// (content no longer squished) and the seeker CTA is honestly shown without
  /// being tappable. Requires showReachButton.
  reachDisabled?: boolean;
  /// Play the entry fade/slide on mount. Default true. The SwipeDeck sets this
  /// false: it keeps each card instance alive across an advance (keyed list, no
  /// remount), so a per-card mount fade would only ever read as a flash.
  animateIn?: boolean;
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
  reachDisabled = false,
  animateIn = true,
}: Props) {
  const firstName = card.kind === 'seeker'
    ? card.name.split(' ')[0]
    : card.ownerName.split(' ')[0];

  // Entry fade/slide on mount. Skipped when animateIn is false (the deck keeps
  // the card mounted across advances, so a replayed fade would just be a flash).
  const cardOpacity = useRef(new Animated.Value(animateIn ? 0 : 1)).current;
  const cardTranslateY = useRef(new Animated.Value(animateIn ? 8 : 0)).current;
  useLayoutEffect(() => {
    if (!animateIn) {
      cardOpacity.setValue(1);
      cardTranslateY.setValue(0);
      return;
    }
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
  }, [card.id, animateIn, cardOpacity, cardTranslateY]);

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
      <HardShadow radius={Radii.card} offset={7} style={styles.hsFill}>
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
                showReachButton={showReachButton}
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
          disabled={reachDisabled}
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
  disabled = false,
}: {
  firstName: string;
  onPress: () => void;
  /// Non-interactive preview state (owner's project-edit Preview): half-opacity,
  /// untappable, no haptics/press animation — purely shows what seekers see.
  disabled?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const press = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    onPress();
  };

  // Static, half-transparent, non-interactive — fills the bottom-right gutter
  // so the content stack reads correctly while making clear it's just a preview.
  if (disabled) {
    return (
      <View style={[styles.reachWrap, styles.reachPreview]} pointerEvents="none">
        <View style={styles.reachContainer}>
          <BlurView intensity={36} tint="default" style={styles.reachBlur}>
            <View style={styles.reachTint} pointerEvents="none" />
            <View style={styles.reachTopHighlight} pointerEvents="none" />
            <PaperPlaneTilt size={20} color={Brand.actionInk} weight="fill" />
          </BlurView>
        </View>
      </View>
    );
  }

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
        // Android fades images in over 300ms by default — reads as a flash when
        // a card is (re)mounted. The URI is already cached from the peek render.
        fadeDuration={0}
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

/// `tone='match'` ties the skill-overlap badge to the card's match vocabulary
/// (the warm-tan matched chips + sage trust pill) with a solid tan fill and a
/// leading dot — visibly a "good fit" signal, distinct from the neutral white
/// `default` badge used for the "Needs … by …" urgency line on project cards.
function MatchBadge({ text, tone = 'default' }: { text: string; tone?: 'default' | 'match' }) {
  const isMatch = tone === 'match';
  return (
    <View style={[styles.badge, isMatch && styles.badgeMatch]}>
      {isMatch && <View style={styles.badgeDot} />}
      <Text
        style={[styles.badgeText, isMatch && styles.badgeTextMatch]}
        numberOfLines={2}
      >
        {text}
      </Text>
    </View>
  );
}

/// Format a `YYYY-MM-DD` deadline into a short "Apr 30" for the badge. Parsed
/// from local calendar parts to avoid a UTC day-shift.
function formatNeededBy(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return '';
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ─── Reply-tier badge ─────────────────────────────────────────────────────
// Warm, public-facing trust signal against the 72h reach-out SLA. Renders a
// worded tier ("Replies fast" / "Responsive") instead of a raw percentage —
// the number lives on the owner's private management card. Returns null below
// the threshold so a weak rate is simply absent, never punishing. Fed the real
// reply-within-72h rate (0–1) of the entity whose responsiveness is shown — the
// seeker for a seeker card, the owner/founder for a project card.
function ReplyTierBadge({ rate }: { rate: number | null | undefined }) {
  const tier = responseTier(rate);
  if (!tier) return null;
  const Icon = tier.kind === 'fast' ? Lightning : ArrowClockwise;
  return (
    <View style={styles.replyBadge}>
      <Icon
        size={12}
        color="#FFFFFF"
        weight={tier.kind === 'fast' ? 'fill' : 'bold'}
      />
      <Text style={styles.replyBadgeText}>{tier.label}</Text>
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
  count,
  active,
  onPress,
}: {
  item: PortfolioItem;
  count: number;
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
          <View style={styles.shipEyebrowRow}>
            <Text style={styles.shipEyebrow} numberOfLines={1}>
              {count} PROJECT{count !== 1 ? 'S' : ''} · SWIPE UP
            </Text>
            <CaretUp size={9} color="rgba(255, 255, 255, 0.66)" weight="bold" />
          </View>
          <Text style={styles.shipTitle} numberOfLines={1}>{item.title}</Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

// ─── Decorative quote glyph (behind vibe text) ────────────────────────────

function VibeBlock({ text, lines = 3 }: { text: string; lines?: number }) {
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
      <Text style={styles.vibeText} numberOfLines={lines}>{text}</Text>
    </View>
  );
}

// ─── Seeker content ────────────────────────────────────────────────────────

interface SeekerContentProps {
  card: Extract<DiscoveryCardData, { kind: 'seeker' }>;
  matchedSkills?: string[];
  onPortfolioPress?: (item: PortfolioItem) => void;
  activePortfolioId?: string | null;
  /// When the reach-out button is shown, the link rail stacks above it;
  /// otherwise (e.g. profile preview) it sits in the bottom-right corner.
  showReachButton?: boolean;
}

/// How many skill chips show before the "+N" expander.
const SKILL_CAP = 5;

/// First complete sentence of the blurb — a clean, full thought instead of a
/// mid-sentence truncation. Falls back to the whole string when there's no
/// terminal punctuation.
function firstSentence(text: string): string {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  const m = t.match(/^.*?[.!?](\s|$)/);
  return (m ? m[0] : t).trim();
}

/// Vertical rail of quick-link icon buttons, stacking up from the reach-out
/// button in the bottom-right gutter. Hidden when the seeker has no links.
function LinkRail({ links, bottom }: { links?: SeekerLinks; bottom: number }) {
  const items = [
    links?.github ? { Icon: GithubLogo, url: links.github } : null,
    links?.site ? { Icon: Globe, url: links.site } : null,
    links?.appStore ? { Icon: AppStoreLogo, url: links.appStore } : null,
  ].filter(Boolean) as { Icon: React.ComponentType<IconProps>; url: string }[];
  if (items.length === 0) return null;
  return (
    <View style={[styles.linkRail, { bottom }]} pointerEvents="box-none">
      {items.map((it, i) => (
        <Pressable
          key={i}
          onPress={() => Linking.openURL(it.url).catch(() => {})}
          style={({ pressed }) => [styles.linkRailBtn, pressed && { opacity: 0.7 }]}
          accessibilityRole="button"
        >
          <it.Icon size={18} color="#F5E9D8" weight="fill" />
        </Pressable>
      ))}
    </View>
  );
}

function SeekerContent({
  card,
  matchedSkills,
  onPortfolioPress,
  activePortfolioId,
  showReachButton = true,
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

  // Skills: show SKILL_CAP, then a "+N" chip that expands the rest in place.
  const [skillsExpanded, setSkillsExpanded] = useState(false);
  const shownSkills = skillsExpanded ? ordered : ordered.slice(0, SKILL_CAP);
  const overflow = ordered.length - SKILL_CAP;

  // Top-right badge text — synthesized from match data
  // Fit signal only — campus is already shown in the eyebrow below.
  const badgeText = sharedCount > 0 ? `${sharedCount} matching skill${sharedCount !== 1 ? 's' : ''}` : '';

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

  const vibeSentence = firstSentence(card.vibeBlurb);

  return (
    <>
      <PhotoBackdrop uri={card.photoUri} />
      <Scrim />

      {badgeText && (
        <View style={styles.badgePosition}>
          <MatchBadge text={badgeText} tone="match" />
        </View>
      )}

      <LinkRail links={card.links} bottom={showReachButton ? 92 : 22} />

      <View style={[styles.stack, styles.stackFull]}>
        {eyebrowText !== '' && (
          <Text style={styles.eyebrow} numberOfLines={1}>{eyebrowText}</Text>
        )}
        <Text style={styles.name} numberOfLines={1}>{card.name.trim() || 'Someone on Ambit'}</Text>
        <ReplyTierBadge rate={card.responseRate} />
        {vibeSentence !== '' && <VibeBlock text={vibeSentence} />}
        <View style={styles.skillsRow}>
          {shownSkills.map((s) => (
            <SkillChip
              key={s}
              label={s}
              matched={matchedSet.has(s.toLowerCase())}
            />
          ))}
          {!skillsExpanded && overflow > 0 && (
            <Pressable
              onPress={() => setSkillsExpanded(true)}
              style={[styles.chip, styles.chipMore]}
              accessibilityRole="button"
              accessibilityLabel={`Show ${overflow} more skills`}
            >
              <Text style={styles.chipText}>+{overflow}</Text>
            </Pressable>
          )}
        </View>
        {featured && (
          <ShippingTile
            item={featured}
            count={card.portfolio.length}
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

  // Top-right urgency badge: the open need + deadline ("Needs Frontend · by
  // Apr 30"). Both are optional — fall back to deadline-only, need-only, then
  // a quiet skill-fit signal. Campus is intentionally omitted (it's already in
  // the eyebrow below).
  const headlineRole = card.rolesSought?.[0];
  const byDate = card.neededBy ? formatNeededBy(card.neededBy) : '';
  const by = byDate ? `by ${byDate}` : null;
  const badgeText =
    headlineRole && by ? `Needs ${headlineRole} · ${by}`
    : headlineRole      ? `Needs ${headlineRole}`
    : by                ? `Needs someone ${by}`
    : sharedCount > 0   ? `${sharedCount} matching skill${sharedCount !== 1 ? 's' : ''}`
    : '';
  // Only the skill-overlap fallback gets the warm match tone; the "Needs …"
  // variants stay neutral white (they're a need, not a fit signal).
  const badgeTone = !headlineRole && !by && sharedCount > 0 ? 'match' : 'default';

  const eyebrowText = campus
    ? `BY ${card.ownerName.toUpperCase()} · ${campus.name.toUpperCase()}`
    : `BY ${card.ownerName.toUpperCase()}`;

  return (
    <>
      <PhotoBackdrop
        uri={card.imageUri ?? card.ownerPhotoUri ?? null}
        fallbackGradient={card.gradient}
        fallbackInitials={initials}
      />
      <Scrim />

      {badgeText !== '' && (
        <View style={styles.badgePosition}>
          <MatchBadge text={badgeText} tone={badgeTone} />
        </View>
      )}

      <View style={[styles.stack, styles.stackFull]}>
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
        <ReplyTierBadge rate={card.responseRate} />
        {card.pitch !== '' && <VibeBlock text={card.pitch} />}
        {/* Only the bottom chip row sits beside the floating reach button, so
            it (not the whole stack) reserves the gutter — the eyebrow/title/
            blurb above use the full card width. Mirrors the seeker card. */}
        <View style={[styles.skillsRow, styles.skillsRowGutter]}>
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
    borderRadius: Radii.card,
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
    gap: 6,
    maxWidth: 190,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
  },
  // Warm-tan fill ties the skill-overlap badge to the matched-skill chips.
  badgeMatch: {
    backgroundColor: 'rgba(201, 164, 122, 0.95)',
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#3A332A',
  },
  badgeText: {
    fontFamily: AmbitFont.body,
    fontSize: 11.5,
    fontWeight: '700',
    color: '#3A332A',
    letterSpacing: 0.2,
    lineHeight: 15,
    textAlign: 'right',
  },
  badgeTextMatch: {
    color: '#2A1E12',
    textAlign: 'left',
  },

  // ── Reply-tier badge (sage-frosted trust pill) ─────────────────────────
  // Sage ties it to the card's existing trust vocabulary (the match-badge
  // dot + the Venn sage), reading as a calm "good" signal distinct from the
  // neutral white skill chips below it.
  replyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    marginTop: -4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(138, 155, 122, 0.72)',
  },
  replyBadgeText: {
    fontFamily: AmbitFont.body,
    fontSize: 11.5,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
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
  // Seeker override: full-width vibe + skills. The reach-out gutter is reserved
  // only on the bottom portfolio tile (shipTile.marginRight), not the whole
  // stack — so the text/chips above use the full card width.
  stackFull: { paddingRight: 0 },
  eyebrow: {
    fontFamily: AmbitFont.body,
    fontSize: 10.5,
    fontWeight: '700',
    // Brighter + tighter tracking than before: at 0.7 opacity with very wide
    // letter-spacing the school line washed out over light photos. A subtle
    // shadow separates it from whatever sits behind the top of the scrim.
    color: 'rgba(245, 233, 216, 0.95)',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    textShadowColor: 'rgba(0, 0, 0, 0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
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
    backgroundColor: 'rgba(212, 180, 144, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(212, 180, 144, 0.72)',
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
  // Project card only: keep the bottom chip row clear of the reach button.
  skillsRowGutter: { paddingRight: 72 },
  // Modern frosted pills — no border. Matched skills get a warm-tan wash,
  // the rest a neutral frosted white; both read on the dark scrim. Fills are
  // a touch more opaque than before so a chip mid-scrim (over a bright photo
  // patch) keeps its edge instead of dissolving into the image.
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.40)',
  },
  chipMatched: {
    backgroundColor: 'rgba(201, 164, 122, 0.62)',
  },
  chipText: {
    fontFamily: AmbitFont.body,
    fontSize: 11.5,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.1,
    // Holds the label legible when the pill sits over a light photo region.
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  chipTextMatched: {
    color: '#FFFFFF',
  },
  // "+N" expander — slightly dimmer so it reads as an affordance, not a skill.
  chipMore: {
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },

  // ── Quick-links rail (stacks up from the reach-out button) ─────────────
  linkRail: {
    position: 'absolute',
    right: 22,
    alignItems: 'center',
    gap: 10,
    zIndex: 4,
  },
  linkRailBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
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
  shipEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
  // Non-interactive preview (owner project-edit Preview): half-transparent.
  reachPreview: {
    opacity: 0.5,
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
