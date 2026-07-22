import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import {
  AppStoreLogo,
  ChatCircle,
  Clock,
  DotsThree,
  GithubLogo,
  Globe,
  Lightning,
  PaperPlaneTilt,
  type IconProps,
} from 'phosphor-react-native';
import * as Haptics from 'expo-haptics';
import { VibeQuote } from '../atoms';
import {
  Astra,
  Brand,
  AmbitFont,
  Radii,
} from '../../constants/theme';
import type { DiscoveryCardData, PortfolioItem, SeekerLinks } from '../../data/mock';
import { CAMPUSES } from '../../data/mock';
import { responseReward, type ResponseReward } from '../../lib/responseRate';
import { useReducedMotion } from '../../hooks/useReducedMotion';

/// Fire the swipe-up "peek" nudge only once per app session — the first
/// discovery card that measures reveals a sliver of page 2, then settles. After
/// that the user knows the gesture, so we don't re-nudge every card.
let sessionNudged = false;

interface Props {
  card: DiscoveryCardData;
  /// Skills to highlight as shared: skill chips whose label appears here render
  /// in the selected (filled) state. For a seeker browsing projects these are
  /// the viewer's own skills; for an owner browsing seekers, the active
  /// project's required skills.
  matchedSkills?: string[];
  onPortfolioPress?: (item: PortfolioItem) => void;
  activePortfolioId?: string | null;
  onReachOut?: (card: DiscoveryCardData) => void;
  /// The swipe deck drives reach-out from its own footer button row, so it
  /// hides the card's floating send circle. Preview contexts (Saved, chat/new,
  /// project-edit) keep it (default true) — it's their only reach affordance.
  showReachButton?: boolean;
  /// Render the send circle in a non-interactive preview state.
  reachDisabled?: boolean;
  /// The gutter pager rail renders outside the card bounds, so the SwipeDeck's
  /// peek (next) card must hide its own or two rails stack in the gutter.
  /// Default true for standalone/preview contexts.
  showPagerDots?: boolean;
  /// Play the entry fade on mount. Default true. The SwipeDeck sets it false.
  animateIn?: boolean;
  /// Safety: when provided, renders a ⋯ overflow button that hands back the
  /// OTHER user's id (seeker → card.id, project → card.ownerId) so the parent
  /// can offer Report / Block. Omitted in the user's own profile preview.
  onFlag?: (userId: string) => void;
}

/// Discovery card — ASTRA two-section design with a swipe-up second screen.
/// Page 1: a white island card (royal→iris gradient photo panel + white info
/// panel). Swipe UP on the card and its content shifts up to reveal Page 2 —
/// portfolio highlights for a seeker, an expanded detail sheet for a project.
/// The deck's PanResponder claims only horizontal pans, so vertical drags fall
/// through to this card's paging ScrollView.
export function DiscoveryCard({
  card,
  matchedSkills,
  onPortfolioPress,
  activePortfolioId,
  onReachOut,
  showReachButton = true,
  reachDisabled = false,
  showPagerDots = true,
  animateIn = true,
  onFlag,
}: Props) {
  const otherUserId = card.kind === 'seeker' ? card.id : card.ownerId;
  // Case-insensitive lookup of the shared skills, so chips can flag matches.
  const matchedSet = useMemo(
    () => new Set((matchedSkills ?? []).map((s) => s.toLowerCase())),
    [matchedSkills],
  );
  // Entry fade on mount (skipped in the deck, which keeps cards mounted).
  const opacity = useRef(new Animated.Value(animateIn ? 0 : 1)).current;
  const translateY = useRef(new Animated.Value(animateIn ? 8 : 0)).current;
  useLayoutEffect(() => {
    if (!animateIn) {
      opacity.setValue(1);
      translateY.setValue(0);
      return;
    }
    opacity.setValue(0);
    translateY.setValue(8);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 240, easing: Easing.bezier(0.16, 1, 0.3, 1), useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 280, easing: Easing.bezier(0.16, 1, 0.3, 1), useNativeDriver: true }),
    ]).start();
  }, [card.id, animateIn, opacity, translateY]);

  // Vertical 2-page pager. We measure the card so each page snaps to exactly
  // one card-height viewport; the deck only claims horizontal pans, so a
  // vertical drag scrolls this instead of swiping the deck.
  const [cardH, setCardH] = useState(0);
  const [page, setPage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const reduced = useReducedMotion();

  // The swipe-up second screen exists only for seekers with portfolio work or
  // links. Project cards are single-page for now — no scrollable detail — so
  // they get no down-arrow. (ProjectDetail is kept for a future project second
  // screen, e.g. short video pitches.)
  const seekerHasWork =
    card.kind === 'seeker' &&
    (card.portfolio.length > 0 ||
      !!(card.links && (card.links.github || card.links.site || card.links.appStore)));
  const hasSecondScreen = seekerHasWork;

  // First-run peek nudge (once per session): briefly reveal a sliver of page 2
  // then settle back, so the swipe-up affordance is discovered without a tap.
  useEffect(() => {
    if (!hasSecondScreen || cardH <= 0 || sessionNudged || reduced) return;
    sessionNudged = true;
    const peek = Math.min(46, cardH * 0.12);
    const t = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: peek, animated: true });
      setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), 540);
    }, 700);
    return () => clearTimeout(t);
  }, [hasSecondScreen, cardH, reduced]);

  const goToPage = (p: 0 | 1) => scrollRef.current?.scrollTo({ y: p * cardH, animated: true });

  return (
    <Animated.View style={[styles.cardOuter, { opacity, transform: [{ translateY }] }]}>
      <View
        style={styles.card}
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          if (h > 0 && Math.abs(h - cardH) > 0.5) setCardH(h);
        }}
      >
        {hasSecondScreen ? (
          <ScrollView
            ref={scrollRef}
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
              {card.kind === 'seeker' ? <SeekerFront card={card} matchedSet={matchedSet} /> : <ProjectFront card={card} />}
            </View>
            <View style={{ height: cardH }}>
              {card.kind === 'seeker'
                ? <SeekerPortfolio card={card} onPortfolioPress={onPortfolioPress} activePortfolioId={activePortfolioId} />
                : <ProjectDetail card={card} matchedSet={matchedSet} />}
            </View>
          </ScrollView>
        ) : (
          card.kind === 'seeker' ? <SeekerFront card={card} matchedSet={matchedSet} /> : <ProjectFront card={card} />
        )}

        {showReachButton && (
          <SendCircle onPress={() => onReachOut?.(card)} disabled={reachDisabled} />
        )}

        {onFlag && (
          <Pressable
            onPress={() => onFlag(otherUserId)}
            // Sit opposite the status badge (seeker badge is top-left, project
            // "LIVE" is top-right) so they never overlap.
            style={[styles.flagBtn, card.kind === 'seeker' ? styles.flagBtnRight : styles.flagBtnLeft]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Report or block"
          >
            <DotsThree size={22} color={Brand.inkOnBrand} weight="bold" />
          </Pressable>
        )}
      </View>

      {showPagerDots && hasSecondScreen && cardH > 0 && (
        <PagerDots
          kind={card.kind}
          page={page}
          onPress={() => goToPage(page === 0 ? 1 : 0)}
        />
      )}
    </Animated.View>
  );
}

// ─── Response reward pill (tiered color + icon + pulse on the top tier) ──────

const TIER_STYLE: Record<
  ResponseReward['tier'],
  { color: string; bg: string; Icon: React.ComponentType<IconProps>; weight: IconProps['weight'] }
> = {
  fast:   { color: '#0E7A5C', bg: 'rgba(14,122,92,0.12)',  Icon: Lightning,   weight: 'fill' },
  medium: { color: '#A9772B', bg: 'rgba(199,154,76,0.18)', Icon: ChatCircle,  weight: 'fill' },
  steady: { color: Brand.inkMuted, bg: 'rgba(123,116,129,0.12)', Icon: Clock, weight: 'regular' },
};

function ResponsePill({ rate }: { rate?: number | null }) {
  const reward = responseReward(rate);
  const reduced = useReducedMotion();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!reward?.reward || reduced) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reward?.reward, reduced, pulse]);

  if (!reward) return null;
  const s = TIER_STYLE[reward.tier];
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });

  return (
    <Animated.View style={[styles.respPill, { backgroundColor: s.bg, transform: [{ scale }] }]}>
      <s.Icon size={13} color={s.color} weight={s.weight} />
      <Text style={[styles.respText, { color: s.color }]} numberOfLines={1}>{reward.label}</Text>
    </Animated.View>
  );
}

// ─── Photo panel (shared) ───────────────────────────────────────────────────

function PhotoPanel({
  uri,
  gradient,
  scrim,
  children,
}: {
  uri: string | null;
  gradient?: readonly [string, string];
  scrim?: boolean;
  children: React.ReactNode;
}) {
  // Polaroid framing: the photo is inset with an even white margin on top/left/
  // right (the card's white showing through), and the info panel below is the
  // thick bottom caption border. `photoFrame` = the margin; `photo` = the print.
  return (
    <View style={styles.photoFrame}>
      <View style={styles.photo}>
        <LinearGradient
          colors={gradient ?? [Astra.royal, Astra.iris]}
          locations={[0, 0.71]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {uri && <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />}
        {scrim && (
          <LinearGradient
            colors={['rgba(12,0,34,0)', 'rgba(12,0,34,0.55)']}
            locations={[0.45, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        )}
        {children}
      </View>
    </View>
  );
}

function StatusBadge({ label }: { label: string }) {
  return (
    <View style={styles.statusBadge}>
      <Text style={styles.statusBadgeText}>{label}</Text>
    </View>
  );
}

/// A skill chip. When `matched` (the label is in the viewer/project's matched
/// skills) it fills with the selected state to signal shared overlap.
function SkillChip({ label, matched = false }: { label: string; matched?: boolean }) {
  return (
    <View style={[styles.chip, matched && styles.chipMatched]}>
      <Text style={[styles.chipText, matched && styles.chipTextMatched]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

/// First complete sentence of the blurb — a clean thought, not a mid-cut.
function firstSentence(text: string): string {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  const m = t.match(/^.*?[.!?](\s|$)/);
  return (m ? m[0] : t).trim();
}

function seekerEyebrow(card: Extract<DiscoveryCardData, { kind: 'seeker' }>): string {
  const campus = CAMPUSES.find((c) => c.id === card.campusId);
  const yy = card.gradYear ? card.gradYear.replace(/^’/, '') : '';
  return [
    card.major && yy ? `${card.major} ’${yy}` : card.major || (yy ? `’${yy}` : ''),
    campus?.name,
  ].filter(Boolean).join(' · ');
}

// ─── Seeker — page 1 (front) ────────────────────────────────────────────────

function SeekerFront({ card, matchedSet }: { card: Extract<DiscoveryCardData, { kind: 'seeker' }>; matchedSet: Set<string> }) {
  const subtitle = seekerEyebrow(card);
  return (
    <>
      <PhotoPanel uri={card.photoUri} scrim>
        <View style={styles.photoTopRow}>
          <StatusBadge label="OPEN TO TEAMS" />
        </View>
        <View style={styles.identity}>
          <Text style={styles.name} numberOfLines={1}>{card.name.trim() || 'Someone on Ambit'}</Text>
          {subtitle !== '' && <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>}
        </View>
      </PhotoPanel>

      <View style={styles.panel}>
        <ResponsePill rate={card.responseRate} />
        {card.vibeBlurb.trim() !== '' && (
          <VibeQuote text={firstSentence(card.vibeBlurb) || card.vibeBlurb} lines={3} />
        )}
        {card.skills.length > 0 && (
          <View style={styles.chipRow}>
            {card.skills.slice(0, 6).map((s) => <SkillChip key={s} label={s} matched={matchedSet.has(s.toLowerCase())} />)}
          </View>
        )}
      </View>
    </>
  );
}

// ─── Seeker — page 2 (portfolio highlights) ─────────────────────────────────

function SeekerPortfolio({
  card,
  onPortfolioPress,
  activePortfolioId,
}: {
  card: Extract<DiscoveryCardData, { kind: 'seeker' }>;
  onPortfolioPress?: (item: PortfolioItem) => void;
  activePortfolioId?: string | null;
}) {
  const links = card.links;
  const hasLinks = !!(links && (links.github || links.site || links.appStore));
  return (
    <View style={styles.page2}>
      <Text style={styles.page2Eyebrow} numberOfLines={1}>{seekerEyebrow(card).toUpperCase()}</Text>
      <Text style={styles.page2Name} numberOfLines={1}>{card.name}</Text>

      <Text style={styles.page2Section}>PORTFOLIO HIGHLIGHTS</Text>
      {card.portfolio.length > 0 ? (
        // 2-up grid: up to 6 highlights (2×3) fill the fixed-height card face.
        // Portfolios are capped at 6 at the source, so the slice is just a guard
        // for any legacy rows that predate the cap.
        <View style={styles.hlGrid}>
          {card.portfolio.slice(0, 6).map((item) => (
            <PortfolioTile
              key={item.id}
              item={item}
              active={activePortfolioId === item.id}
              onPress={() => onPortfolioPress?.(item)}
            />
          ))}
        </View>
      ) : (
        <Text style={styles.page2Empty}>No portfolio highlights yet.</Text>
      )}

      {hasLinks && (
        <>
          <Text style={styles.page2Section}>LINKS</Text>
          <View style={styles.linkRow}>
            {links!.github && <LinkIcon Icon={GithubLogo} url={links!.github} label="GitHub" />}
            {links!.site && <LinkIcon Icon={Globe} url={links!.site} label="Website" />}
            {links!.appStore && <LinkIcon Icon={AppStoreLogo} url={links!.appStore} label="App Store" />}
          </View>
        </>
      )}
    </View>
  );
}

function PortfolioTile({
  item,
  active,
  onPress,
}: {
  item: PortfolioItem;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.hlTile, (pressed || active) && { opacity: 0.85 }]}
      accessibilityRole="button"
      accessibilityLabel={`Open ${item.title}`}
    >
      {item.imageUri ? (
        <Image source={{ uri: item.imageUri }} style={styles.hlTileCover} contentFit="cover" cachePolicy="memory-disk" transition={180} />
      ) : (
        <LinearGradient colors={item.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hlTileCover} />
      )}
      <Text style={styles.hlTileTitle} numberOfLines={1}>{item.title}</Text>
      <Text style={styles.hlTileSub} numberOfLines={1}>{item.description}</Text>
    </Pressable>
  );
}

function LinkIcon({ Icon, url, label }: { Icon: React.ComponentType<IconProps>; url: string; label: string }) {
  return (
    <Pressable
      onPress={() => Linking.openURL(url).catch(() => {})}
      style={({ pressed }) => [styles.linkIcon, pressed && { opacity: 0.6 }]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Icon size={20} color={Brand.primary} weight="regular" />
    </Pressable>
  );
}

// ─── Project — page 1 (front) ───────────────────────────────────────────────

function ProjectFront({ card }: { card: Extract<DiscoveryCardData, { kind: 'project' }> }) {
  const ownerInitials =
    card.ownerName.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';
  return (
    <>
      <PhotoPanel uri={card.imageUri ?? card.ownerPhotoUri ?? null} gradient={card.gradient}>
        <View style={styles.photoTopRowRight}>
          <StatusBadge label="LIVE" />
        </View>
      </PhotoPanel>

      <View style={styles.panelProject}>
        <Text style={styles.projectTitle} numberOfLines={1}>{card.title}</Text>
        {card.pitch.trim() !== '' && <VibeQuote text={card.pitch} lines={2} />}
        <View style={styles.metaRow}>
          <LinearGradient colors={[Astra.royal, Astra.iris]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ownerAvatar}>
            <Text style={styles.ownerAvatarText}>{ownerInitials}</Text>
          </LinearGradient>
          <ResponsePill rate={card.responseRate} />
        </View>
      </View>
    </>
  );
}

// ─── Project — page 2 (expanded detail) ─────────────────────────────────────

function formatNeededBy(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return '';
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function ProjectDetail({ card, matchedSet }: { card: Extract<DiscoveryCardData, { kind: 'project' }>; matchedSet: Set<string> }) {
  const campus = CAMPUSES.find((c) => c.id === card.ownerCampusId);
  const eyebrow = campus
    ? `BY ${card.ownerName.toUpperCase()} · ${campus.name.toUpperCase()}`
    : `BY ${card.ownerName.toUpperCase()}`;
  const by = card.neededBy ? formatNeededBy(card.neededBy) : '';

  return (
    <View style={styles.page2}>
      <Text style={styles.page2Eyebrow} numberOfLines={1}>{eyebrow}</Text>
      <Text style={styles.page2Name} numberOfLines={2}>{card.title}</Text>
      <ResponsePill rate={card.responseRate} />

      {card.pitch.trim() !== '' && <Text style={styles.detailBody} numberOfLines={5}>{card.pitch}</Text>}

      {card.rolesSought && card.rolesSought.length > 0 && (
        <>
          <Text style={styles.page2Section}>ROLES SOUGHT</Text>
          <View style={styles.chipRow}>
            {card.rolesSought.map((r) => <SkillChip key={r} label={r} />)}
          </View>
        </>
      )}

      {card.skillsSought.length > 0 && (
        <>
          <Text style={styles.page2Section}>SKILLS</Text>
          <View style={styles.chipRow}>
            {card.skillsSought.slice(0, 8).map((s) => <SkillChip key={s} label={s} matched={matchedSet.has(s.toLowerCase())} />)}
          </View>
        </>
      )}

      {by !== '' && <Text style={styles.detailNeeded}>Looking to bring someone on by {by}.</Text>}
    </View>
  );
}

// ─── Pager dots (vertical rail in the side gutter) ──────────────────────────
// Position indicator for the 2-page card. Sits OFF the card, centered in the
// deck's 24px side gutter, so it reads as deliberate chrome rather than an
// overlay. Current page = tall Brand.selected pill; other page = grey dot.
// The rail is also the tap affordance (replaces the old caret) — tapping it
// toggles pages, so the second screen stays reachable without the gesture.

function PagerDots({
  kind,
  page,
  onPress,
}: {
  kind: 'seeker' | 'project';
  page: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={14}
      style={styles.dotsRail}
      accessibilityRole="button"
      accessibilityLabel={
        page === 1
          ? 'Back to profile'
          : kind === 'seeker'
            ? 'Show portfolio highlights'
            : 'Show project details'
      }
    >
      {[0, 1].map((i) => (
        <PagerDot key={i} active={page === i} />
      ))}
    </Pressable>
  );
}

function PagerDot({ active }: { active: boolean }) {
  const anim = useRef(new Animated.Value(active ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: active ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.quad),
      // Height + color interpolation — layout props, so no native driver.
      useNativeDriver: false,
    }).start();
  }, [active, anim]);
  const height = anim.interpolate({ inputRange: [0, 1], outputRange: [6, 28] });
  const backgroundColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(28,27,27,0.18)', Brand.selected],
  });
  return <Animated.View style={[styles.dot, { height, backgroundColor }]} />;
}

// ─── Send circle (preview-only reach affordance) ────────────────────────────

function SendCircle({ onPress, disabled }: { onPress: () => void; disabled: boolean }) {
  const scale = useRef(new Animated.Value(1)).current;
  if (disabled) {
    return (
      <View style={[styles.sendWrap, styles.sendPreview]} pointerEvents="none">
        <View style={styles.sendCircle}>
          <PaperPlaneTilt size={22} color={Brand.inkOnBrand} weight="fill" />
        </View>
      </View>
    );
  }
  return (
    <View style={styles.sendWrap} pointerEvents="box-none">
      <Pressable
        onPress={() => {
          if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          onPress();
        }}
        onPressIn={() => Animated.spring(scale, { toValue: 0.94, friction: 8, tension: 220, useNativeDriver: true }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, friction: 5, tension: 180, useNativeDriver: true }).start()}
        accessibilityRole="button"
        accessibilityLabel="Reach out"
      >
        <Animated.View style={[styles.sendCircle, { transform: [{ scale }] }]}>
          <PaperPlaneTilt size={22} color={Brand.inkOnBrand} weight="fill" />
        </Animated.View>
      </Pressable>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  cardOuter: {
    flex: 1,
    borderRadius: Radii.sm,
    backgroundColor: Brand.cardCream,
    shadowColor: Astra.royal,
    shadowOpacity: 0.12,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  card: {
    flex: 1,
    borderRadius: Radii.sm,
    borderWidth: 1,
    borderColor: Astra.hairlinePurple,
    backgroundColor: Brand.cardCream,
    overflow: 'hidden',
    position: 'relative',
  },
  // ⋯ report/block overlay — a subtle scrim disc over the photo panel.
  flagBtn: {
    position: 'absolute',
    top: 14,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  flagBtnRight: { right: 14 },
  flagBtnLeft: { left: 14 },

  // ── Photo panel (Polaroid) ────────────────────────────────────────────────
  // The white margin around the print — even on top/left/right; the bottom is
  // the info-panel caption, so no bottom padding here.
  photoFrame: {
    flex: 1,
    paddingTop: 16,
    paddingHorizontal: 16,
  },
  // The print itself — the image clips to a slightly-rounded rect with a faint
  // edge so it reads as a photo sitting on the white card.
  photo: {
    flex: 1,
    paddingTop: 14,
    paddingHorizontal: 16,
    paddingBottom: 16,
    justifyContent: 'space-between',
    overflow: 'hidden',
    borderRadius: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(28,27,27,0.10)',
  },
  photoTopRow: { flexDirection: 'row', alignItems: 'center' },
  photoTopRowRight: { flexDirection: 'row', justifyContent: 'flex-end' },

  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(12,0,34,0.35)',
    borderWidth: 1,
    borderColor: Astra.whiteA40,
  },
  statusBadgeText: {
    fontFamily: AmbitFont.semibold,
    fontSize: 10,
    color: '#FFFFFF',
    letterSpacing: 1,
  },

  identity: { gap: 3 },
  name: { fontFamily: AmbitFont.display, fontSize: 30, color: '#FFFFFF', letterSpacing: -0.4 },
  subtitle: { fontFamily: AmbitFont.medium, fontSize: 14, color: '#E9E2F4' },

  // ── White info panel (Polaroid caption) ───────────────────────────────────
  // Modest bottom padding — just enough to clear the small corner arrow. (Was
  // 44/40 to reserve room for a full-width pull-up pill, which left an awkward
  // empty strip once that became a corner chevron.)
  panel: { paddingTop: 16, paddingHorizontal: 16, paddingBottom: 26, gap: 12 },
  panelProject: { paddingTop: 14, paddingHorizontal: 14, paddingBottom: 26, gap: 10 },
  desc: { fontFamily: AmbitFont.body, fontSize: 14, lineHeight: 20, color: Brand.inkBody },
  projectTitle: { fontFamily: AmbitFont.display, fontSize: 20, color: Brand.inkPrimary },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  chip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(147,98,200,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(111,77,162,0.28)',
  },
  chipText: { fontFamily: AmbitFont.medium, fontSize: 12, color: Brand.selected },
  // Matched (shared) skill → selected fill + white label, mirroring the
  // selected state of the Chip atom / filter-sheet chips.
  chipMatched: { backgroundColor: Brand.selected, borderColor: Brand.selected },
  chipTextMatched: { color: Brand.inkOnBrand },

  // ── Response reward pill ──────────────────────────────────────────────────
  respPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  respText: { fontFamily: AmbitFont.semibold, fontSize: 12 },

  // ── Project meta row ──────────────────────────────────────────────────────
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ownerAvatar: {
    width: 30,
    height: 30,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Brand.canvas,
  },
  ownerAvatarText: { fontFamily: AmbitFont.display, fontSize: 12, color: '#FFFFFF' },

  // ── Page 2 (portfolio / detail) ───────────────────────────────────────────
  page2: {
    flex: 1,
    backgroundColor: Brand.cardCream,
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 30, // clears the corner arrow
  },
  page2Eyebrow: {
    fontFamily: AmbitFont.semibold,
    fontSize: 10.5,
    letterSpacing: 1.4,
    color: Brand.accent,
  },
  page2Name: {
    fontFamily: AmbitFont.display,
    fontSize: 24,
    color: Brand.inkPrimary,
    marginTop: 3,
    letterSpacing: -0.3,
  },
  page2Section: {
    fontFamily: AmbitFont.semibold,
    fontSize: 10,
    letterSpacing: 1.6,
    color: Brand.inkLabel,
    marginTop: 20,
    marginBottom: 10,
  },
  page2Empty: { fontFamily: AmbitFont.body, fontSize: 13, color: Brand.inkMuted, marginTop: 6 },

  // 2-up grid: two tiles per row (each ~48% wide) with a landscape cover so two
  // rows + the links section fit within the fixed-height card face.
  hlGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  hlTile: { width: '48%' },
  hlTileCover: {
    width: '100%',
    aspectRatio: 1.6,
    borderRadius: Radii.md,
    backgroundColor: Brand.surface2,
    borderWidth: 1,
    borderColor: Astra.hairlinePurple,
  },
  hlTileTitle: { fontFamily: AmbitFont.semibold, fontSize: 13.5, color: Brand.inkPrimary, marginTop: 8 },
  hlTileSub: { fontFamily: AmbitFont.body, fontSize: 12, lineHeight: 16, color: Brand.inkMuted, marginTop: 2 },

  linkRow: { flexDirection: 'row', gap: 10 },
  linkIcon: {
    width: 44,
    height: 44,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brand.cardCream,
    borderWidth: 1,
    borderColor: 'rgba(111,77,162,0.28)',
  },

  detailBody: { fontFamily: AmbitFont.body, fontSize: 14, lineHeight: 21, color: Brand.inkBody, marginTop: 14 },
  detailNeeded: { fontFamily: AmbitFont.medium, fontSize: 13, color: Brand.inkLabel, marginTop: 18 },

  // ── Pager arrow (bouncing down-chevron, bottom-right) ─────────────────────
  // Rail lives OUTSIDE the card, centered in the deck's 24px side gutter
  // (right: -15 puts the 6px dot's center 12px off the card edge). Needs
  // overflow left visible on cardOuter — fine on iOS and Fabric Android.
  dotsRail: {
    position: 'absolute',
    right: -15,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    zIndex: 6,
  },
  dot: {
    width: 6,
    borderRadius: 999,
  },


  // ── Send circle (preview reach affordance) ────────────────────────────────
  sendWrap: { position: 'absolute', bottom: 16, right: 16, zIndex: 5 },
  sendPreview: { opacity: 0.5 },
  sendCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brand.selected,
    borderWidth: 1,
    borderColor: 'rgba(111,77,162,0.3)',
    shadowColor: Astra.royal,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
