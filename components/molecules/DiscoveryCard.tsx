import React, { useRef } from 'react';
import {
  Animated,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Svg, { Path, Circle, Text as SvgText } from 'react-native-svg';
import { PaperPlaneTilt } from 'phosphor-react-native';
import * as Haptics from 'expo-haptics';
import {
  Brand,
  AmbitFont,
  Radii,
  Space,
} from '../../constants/theme';
import type { DiscoveryCardData, PortfolioItem } from '../../data/mock';
import { CAMPUSES } from '../../data/mock';

interface Props {
  card: DiscoveryCardData;
  /// Skills the viewer cares about (their project's skill list when an
  /// owner is viewing seekers, the viewer's own skill list when a seeker
  /// is viewing projects). Used to compute the shared-skill count in the
  /// Venn diagram and to tag matched skills in the capability list.
  matchedSkills?: string[];
  onPortfolioPress?: (item: PortfolioItem) => void;
  activePortfolioId?: string | null;
  onReachOut?: (card: DiscoveryCardData) => void;
}

/// Discovery card — visual half only. No gestures, no state. SwipeDeck
/// wraps this with the PanResponder.
///
/// Layout matches g-synthesis.html: framed square photo, identity, vibe
/// pull-quote with a giant decorative SVG curl behind it, terracotta
/// wave-glyph skill rows, portfolio preview (seeker only), Venn overlap,
/// liquid-glass brown CTA pinned at the bottom.
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
          <ProjectContent card={card} matchedSkills={matchedSkills} />
        )}
      </ScrollView>

      <ReachOutLiquidGlass
        firstName={firstName}
        onPress={() => onReachOut?.(card)}
      />
    </View>
  );
}

// ─── Liquid-glass CTA ──────────────────────────────────────────────────────
// BlurView captures content scrolling underneath natively (UIVisualEffectView
// on iOS, FrameLayout blur on Android). Layered: blur → brown tint → top
// highlight → contents.

function ReachOutLiquidGlass({
  firstName,
  onPress,
}: {
  firstName: string;
  onPress: () => void;
}) {
  const press = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    onPress();
  };
  return (
    <View style={styles.ctaWrap} pointerEvents="box-none">
      <Pressable
        onPress={press}
        style={({ pressed }) => [
          styles.ctaContainer,
          pressed && { transform: [{ scale: 0.985 }] },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Reach out to ${firstName}`}
      >
        <BlurView intensity={48} tint="default" style={styles.ctaBlur}>
          <View style={styles.ctaTint} pointerEvents="none" />
          <View style={styles.ctaTopHighlight} pointerEvents="none" />
          <PaperPlaneTilt size={16} color={Brand.cardCream} weight="fill" />
          <Text style={styles.ctaLabel}>Reach out to {firstName}</Text>
        </BlurView>
      </Pressable>
    </View>
  );
}

// ─── Shared sub-components ─────────────────────────────────────────────────

function Eyebrow({
  children,
  color = Brand.accent,
}: {
  children: string;
  color?: string;
}) {
  return <Text style={[styles.eyebrow, { color }]}>{children}</Text>;
}

/// Square photo (1:1) inside D's thin warm-tan gradient hairline frame.
/// Aspect ratio chosen for chat-avatar portability — same crop works
/// in inbox row, chat header, discovery overview, etc.
function FramedPhoto({
  uri,
  fallbackGradient,
  fallbackInitials,
}: {
  uri: string | null;
  fallbackGradient?: readonly [string, string];
  fallbackInitials?: string;
}) {
  return (
    <View style={styles.photoStage}>
      <LinearGradient
        colors={[Brand.accent, 'rgba(180, 128, 69, 0.32)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.photoFrame}
      >
        <View style={styles.photoInner}>
          {uri ? (
            <Image source={{ uri }} style={styles.photoImg} resizeMode="cover" />
          ) : (
            <LinearGradient
              colors={fallbackGradient ?? [Brand.primary, Brand.accent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.photoFallback}
            >
              {fallbackInitials && (
                <Text style={styles.photoFallbackInitials}>{fallbackInitials}</Text>
              )}
            </LinearGradient>
          )}
        </View>
      </LinearGradient>
    </View>
  );
}

/// Vibe pull-quote — giant decorative italic curly quote glyph behind
/// the italic body text. Using the system serif italic gives us the
/// actual `“` character at large size (looks identical to the HTML
/// mock's Fraunces fallback). RN renders this as a styled Text layer
/// underneath the body Text via absolute positioning + zIndex.
function VibePullQuote({ text }: { text: string }) {
  return (
    <View style={styles.vibePull}>
      <Text
        style={styles.vibeGlyph}
        pointerEvents="none"
        allowFontScaling={false}
        numberOfLines={1}
      >
        {'“'}
      </Text>
      <Text style={styles.vibeText}>{text}</Text>
    </View>
  );
}

/// Single skill row with a wave-contour glyph in terracotta for matched
/// skills (3 stacked sines at descending opacity) or muted gray for
/// non-matched (single sine).
function SkillRow({
  label,
  matched,
}: {
  label: string;
  matched: boolean;
}) {
  const color = matched ? Brand.terracotta : Brand.inkLabel;
  return (
    <View style={styles.skillRow}>
      <Svg width={24} height={14} viewBox="0 0 24 14">
        <Path
          d="M0 7 Q 6 2 12 7 T 24 7"
          stroke={color}
          strokeWidth={1.2}
          fill="none"
        />
        {matched && (
          <>
            <Path
              d="M0 11 Q 7 6 14 11 T 24 11"
              stroke={color}
              strokeWidth={1.2}
              fill="none"
              opacity={0.55}
            />
            <Path
              d="M0 3 Q 8 -2 15 3 T 24 3"
              stroke={color}
              strokeWidth={1.2}
              fill="none"
              opacity={0.32}
            />
          </>
        )}
      </Svg>
      <Text
        style={[
          styles.skillLabel,
          matched && styles.skillLabelMatched,
        ]}
      >
        {label}
      </Text>
      {matched && <Text style={styles.skillTag}>SHARED</Text>}
    </View>
  );
}

/// Portfolio preview tile — 16:10 cover (gradient placeholder until real
/// project images land) + title only. Whole tile is pressable; the
/// scale-spring press feedback (two-stage: snap down quick, spring back)
/// makes the tap-to-modal feel physically connected. Pattern matches
/// PortfolioBubble.tsx so the codebase's motion vocabulary stays coherent.
function PortfolioPreview({
  item,
  active,
  onPress,
}: {
  item: PortfolioItem;
  active: boolean;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () => {
    Animated.spring(scale, {
      toValue: 0.96,
      friction: 8,
      tension: 220,
      useNativeDriver: true,
    }).start();
  };
  const onPressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      friction: 5,
      tension: 180,
      useNativeDriver: true,
    }).start();
  };
  return (
    <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}>
      <Animated.View
        style={[styles.portfolioPreview, { transform: [{ scale }] }]}
      >
        <View style={[styles.portfolioCover, active && styles.portfolioCoverActive]}>
          {item.imageUri ? (
            <Image source={{ uri: item.imageUri }} style={styles.portfolioCoverImg} resizeMode="cover" />
          ) : (
            <LinearGradient
              colors={item.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.portfolioCoverFill}
            >
              <View style={styles.portfolioCoverOutline} pointerEvents="none" />
            </LinearGradient>
          )}
        </View>
        <Text style={styles.portfolioTitle} numberOfLines={1}>
          {item.title}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

/// The Overlap — two-circle Venn (warm tan + sage) with the shared-skill
/// count and labeled axes. Visual anchor for "why you two", replaces a
/// text-only why-line.
function OverlapVenn({
  sharedCount,
  leftLabel,
  rightLabel,
}: {
  sharedCount: number;
  leftLabel: string;
  rightLabel: string;
}) {
  return (
    <View style={styles.overlap}>
      <Svg
        width="100%"
        height={130}
        viewBox="0 0 320 130"
        preserveAspectRatio="xMidYMid meet"
      >
        <Circle
          cx={125}
          cy={65}
          r={55}
          fill="rgba(180, 128, 69, 0.18)"
          stroke="rgba(180, 128, 69, 0.55)"
          strokeWidth={1.5}
        />
        <Circle
          cx={195}
          cy={65}
          r={55}
          fill="rgba(138, 155, 122, 0.22)"
          stroke="rgba(138, 155, 122, 0.6)"
          strokeWidth={1.5}
        />
        <SvgText
          x={160}
          y={62}
          fontSize={30}
          fontStyle="italic"
          textAnchor="middle"
          fill={Brand.seekerInk}
        >
          {String(sharedCount)}
        </SvgText>
        <SvgText
          x={160}
          y={80}
          fontSize={9}
          fontWeight="700"
          textAnchor="middle"
          fill={Brand.seekerInk}
          letterSpacing="2"
        >
          SHARED
        </SvgText>
        <SvgText
          x={78}
          y={125}
          fontSize={10}
          fontWeight="700"
          textAnchor="middle"
          fill={Brand.inkLabel}
          letterSpacing="1.8"
        >
          {leftLabel.toUpperCase()}
        </SvgText>
        <SvgText
          x={242}
          y={125}
          fontSize={10}
          fontWeight="700"
          textAnchor="middle"
          fill={Brand.inkLabel}
          letterSpacing="1.8"
        >
          {rightLabel.toUpperCase()}
        </SvgText>
      </Svg>
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
  const firstName = card.name.split(' ')[0];

  return (
    <View style={styles.body}>
      <FramedPhoto uri={card.photoUri} />

      <View style={styles.identity}>
        <Text style={styles.name}>{card.name}</Text>
        <Text style={styles.role} numberOfLines={1}>
          {campus ? `${campus.name}` : ''}
        </Text>
      </View>

      {card.vibeBlurb !== '' && <VibePullQuote text={card.vibeBlurb} />}

      {card.skills.length > 0 && (
        <View style={styles.section}>
          <Eyebrow>WHAT THEY BUILD</Eyebrow>
          <View style={styles.skillsBox}>
            {ordered.map((s) => (
              <SkillRow
                key={s}
                label={s}
                matched={matchedSet.has(s.toLowerCase())}
              />
            ))}
          </View>
        </View>
      )}

      {featured && (
        <View style={styles.section}>
          <Eyebrow>CURRENTLY SHIPPING</Eyebrow>
          <PortfolioPreview
            item={featured}
            active={activePortfolioId === featured.id}
            onPress={() => onPortfolioPress?.(featured)}
          />
        </View>
      )}

      {(sharedCount > 0 || campus) && (
        <View style={styles.section}>
          <Eyebrow>THE OVERLAP</Eyebrow>
          <OverlapVenn
            sharedCount={sharedCount}
            leftLabel={firstName}
            rightLabel="You"
          />
        </View>
      )}
    </View>
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
  const ownerFirstName = card.ownerName.split(' ')[0];

  return (
    <View style={styles.body}>
      <FramedPhoto
        uri={null}
        fallbackGradient={card.gradient}
        fallbackInitials={initials}
      />

      <View style={styles.identity}>
        <Text style={styles.name} numberOfLines={2}>{card.title}</Text>
        <View style={styles.ownerRow}>
          <View style={styles.ownerAvatar}>
            {card.ownerPhotoUri ? (
              <Image source={{ uri: card.ownerPhotoUri }} style={styles.ownerAvatarImg} />
            ) : (
              <Text style={styles.ownerAvatarInitial}>{card.ownerName[0]}</Text>
            )}
          </View>
          <Text style={styles.role} numberOfLines={1}>
            {card.ownerName}{campus ? ` · ${campus.name}` : ''}
          </Text>
        </View>
      </View>

      {card.pitch !== '' && <VibePullQuote text={card.pitch} />}

      {card.skillsSought.length > 0 && (
        <View style={styles.section}>
          <Eyebrow>LOOKING FOR</Eyebrow>
          <View style={styles.skillsBox}>
            {ordered.map((s) => (
              <SkillRow
                key={s}
                label={s}
                matched={matchedSet.has(s.toLowerCase())}
              />
            ))}
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Eyebrow>THE OVERLAP</Eyebrow>
        <OverlapVenn
          sharedCount={sharedCount}
          leftLabel={ownerFirstName}
          rightLabel="You"
        />
      </View>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: Brand.cardCream,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Brand.borderSoft,
    overflow: 'hidden',
    position: 'relative',
  },
  scroll: { flex: 1 },
  scrollPad: {
    paddingBottom: 110, // clear the floating CTA
  },

  body: {
    paddingHorizontal: 24,
    paddingTop: 26,
    gap: 30,
  },

  // ── Photo frame (square, gradient hairline) ─────────────────────────────
  photoStage: {
    width: '100%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoFrame: {
    width: '86%',
    aspectRatio: 1,
    padding: 1,
    borderRadius: 13,
    shadowColor: '#4D361D',
    shadowOpacity: 0.22,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 18 },
    elevation: 6,
  },
  photoInner: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Brand.cardCream,
  },
  photoImg: {
    width: '100%',
    height: '100%',
  },
  photoFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoFallbackInitials: {
    fontFamily: AmbitFont.display,
    fontSize: 72,
    color: 'rgba(255, 255, 255, 0.88)',
    letterSpacing: 2,
  },

  // ── Identity ────────────────────────────────────────────────────────────
  identity: {
    gap: 8,
  },
  name: {
    fontFamily: AmbitFont.display,
    fontSize: 34,
    lineHeight: 36,
    color: Brand.seekerInk,
    letterSpacing: -0.4,
  },
  role: {
    fontFamily: AmbitFont.body,
    fontSize: 13,
    color: Brand.inkLabel,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  ownerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ownerAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Brand.seekerSurface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  ownerAvatarImg: { width: '100%', height: '100%' },
  ownerAvatarInitial: {
    fontFamily: AmbitFont.body,
    fontSize: 11,
    fontWeight: '700',
    color: Brand.seekerInk,
  },

  // ── Vibe pull-quote ─────────────────────────────────────────────────────
  vibePull: {
    position: 'relative',
    paddingTop: 16,
    paddingLeft: 0,
    paddingRight: 4,
    paddingBottom: 4,
  },
  // Giant decorative italic curly quote behind the vibe text. Letting
  // RN compute lineHeight from fontSize avoids clipping (a smaller
  // lineHeight cropped the 160px glyph to small bottom slivers). The
  // visible curl portion of an italic " sits in the upper ~40% of the
  // em-box; with a slightly negative top, the curl lands across the
  // first words of the vibe text below.
  vibeGlyph: {
    position: 'absolute',
    top: -40,
    left: -8,
    width: 260,             // wide enough for the full double-curl glyph
    fontSize: 170,
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
    fontStyle: 'italic',
    color: Brand.primary,
    opacity: 0.5,
    letterSpacing: -2,
    includeFontPadding: false,
    zIndex: 0,
  },
  vibeText: {
    position: 'relative',
    zIndex: 1,
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
    fontStyle: 'italic',
    fontSize: 24,
    lineHeight: 32,
    color: Brand.seekerInk,
    letterSpacing: -0.3,
  },

  // ── Section ─────────────────────────────────────────────────────────────
  section: {
    gap: 14,
  },
  eyebrow: {
    fontFamily: AmbitFont.body,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },

  // ── Skills (terracotta wave glyphs) ─────────────────────────────────────
  skillsBox: {
    backgroundColor: Brand.terracottaSurface,
    borderColor: Brand.terracottaBorder,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  skillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  skillLabel: {
    fontFamily: AmbitFont.body,
    fontSize: 15,
    color: Brand.inkBody,
    fontWeight: '500',
    flex: 1,
  },
  skillLabelMatched: {
    color: Brand.seekerInk,
    fontWeight: '600',
  },
  skillTag: {
    fontFamily: AmbitFont.body,
    fontSize: 9.5,
    fontWeight: '700',
    color: Brand.terracotta,
    letterSpacing: 1.7,
    textTransform: 'uppercase',
  },

  // ── Portfolio preview (16:10 cover, title only) ─────────────────────────
  portfolioPreview: {
    gap: 12,
  },
  portfolioCover: {
    width: '100%',
    aspectRatio: 16 / 10,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#4D361D',
    shadowOpacity: 0.24,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4,
  },
  portfolioCoverActive: {
    // subtle ring when matching modal is open
    borderWidth: 1.5,
    borderColor: Brand.accent,
  },
  portfolioCoverFill: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  portfolioCoverOutline: {
    position: 'absolute',
    top: 38,
    left: 90,
    right: 90,
    bottom: 38,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.36)',
  },
  portfolioCoverImg: {
    width: '100%',
    height: '100%',
  },
  portfolioTitle: {
    fontFamily: AmbitFont.display,
    fontSize: 19,
    color: Brand.seekerInk,
    letterSpacing: -0.2,
  },

  // ── Overlap Venn ────────────────────────────────────────────────────────
  overlap: {
    backgroundColor: Brand.sageBg,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 16,
    alignItems: 'center',
  },

  // ── Liquid-glass CTA ────────────────────────────────────────────────────
  ctaWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    zIndex: 5,
  },
  ctaContainer: {
    borderRadius: 999,
    overflow: 'hidden',
    // Heavier shadow — pulls the pill clearly off the cream surface so
    // it reads as a primary, tappable action (huashu Light/Dark Mode
    // Contrast guidance: glass on light needs strong edge definition).
    shadowColor: '#281810',
    shadowOpacity: 0.55,
    shadowRadius: 36,
    shadowOffset: { width: 0, height: 14 },
    elevation: 10,
    // Outer hairline stroke gives the pill a defined edge even on the
    // light cream card surface where the glass tint blends in.
    borderWidth: 1,
    borderColor: Brand.glassEdge,
  },
  ctaBlur: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    overflow: 'hidden',
  },
  ctaTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Brand.glassInk,
  },
  ctaTopHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: Brand.glassHighlight,
  },
  ctaLabel: {
    fontFamily: AmbitFont.body,
    fontSize: 15,
    fontWeight: '600',
    color: Brand.cardCream,
    letterSpacing: 0.1,
  },
});
