import React, { useLayoutEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { CaretRight, DotsThree, PaperPlaneTilt } from 'phosphor-react-native';
import * as Haptics from 'expo-haptics';
import { Avatar, VibeQuote } from '../atoms';
import {
  Astra,
  Brand,
  AmbitFont,
  Radii,
} from '../../constants/theme';
import type { DiscoveryCardData, PortfolioItem } from '../../data/mock';

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
  /// Legacy 2-page pager affordance — the v2 card is single-page (the seeker's
  /// project list scrolls in place), so this is accepted for compatibility and
  /// ignored.
  showPagerDots?: boolean;
  /// Play the entry fade on mount. Default true. The SwipeDeck sets it false.
  animateIn?: boolean;
  /// Safety: when provided, renders a ⋯ overflow button that hands back the
  /// OTHER user's id (seeker → card.id, project → card.ownerId) so the parent
  /// can offer Report / Block. Omitted in the user's own profile preview.
  onFlag?: (userId: string) => void;
}

/// Discovery card — v2 "about the work" design (Figma: Discovery Seeker Card /
/// Discovery Project Card).
///
/// Seeker: name + headline top-left, monster avatar top-right, centered skill
/// chips, then a SCROLLABLE list of their projects (portfolio items) — each
/// row a thumbnail, title, one-line description, and a right chevron that
/// opens the full PortfolioModal. It's about the work people have done, not
/// titles.
///
/// Project: centered title + industry line, a compact owner row (avatar +
/// name), the roles they're looking for as chips, and the 3-sentence
/// elevator pitch.
///
/// Single page — the old swipe-up second screen is gone; the deck's
/// PanResponder claims only horizontal pans, so vertical drags fall through
/// to the seeker card's project ScrollView.
export function DiscoveryCard({
  card,
  matchedSkills,
  onPortfolioPress,
  activePortfolioId,
  onReachOut,
  showReachButton = true,
  reachDisabled = false,
  showPagerDots: _showPagerDots = true,
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

  return (
    <Animated.View style={[styles.cardOuter, { opacity, transform: [{ translateY }] }]}>
      <View style={styles.card}>
        {card.kind === 'seeker' ? (
          <SeekerFace
            card={card}
            matchedSet={matchedSet}
            onPortfolioPress={onPortfolioPress}
            activePortfolioId={activePortfolioId}
          />
        ) : (
          <ProjectFace card={card} matchedSet={matchedSet} />
        )}

        {showReachButton && (
          <SendCircle onPress={() => onReachOut?.(card)} disabled={reachDisabled} />
        )}

        {onFlag && (
          <Pressable
            onPress={() => onFlag(otherUserId)}
            // Seeker cards keep the top-right corner for the avatar, so the ⋯
            // sits top-left there; project cards center their title, so the
            // top-right corner is free.
            style={[styles.flagBtn, card.kind === 'seeker' ? styles.flagBtnLeft : styles.flagBtnRight]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Report or block"
          >
            <DotsThree size={20} color={Brand.inkMuted} weight="bold" />
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

/// A skill / role chip. When `matched` (the label is in the viewer/project's
/// matched skills) it fills with the selected state to signal shared overlap.
function SkillChip({ label, matched = false }: { label: string; matched?: boolean }) {
  return (
    <View style={[styles.chip, matched && styles.chipMatched]}>
      <Text style={[styles.chipText, matched && styles.chipTextMatched]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

/// Fallback subtitle when no headline is set — "Computer Science ’26". Study
/// info only: vicinity ("IN PERSON"/"REMOTE") is a matching preference, and
/// standing alone under the name it read like a job title. No major/year
/// either → the line is hidden entirely.
function seekerEyebrow(card: Extract<DiscoveryCardData, { kind: 'seeker' }>): string {
  const yy = card.gradYear ? card.gradYear.replace(/^’/, '') : '';
  return card.major && yy ? `${card.major} ’${yy}` : card.major || (yy ? `’${yy}` : '');
}

// ─── Seeker face ────────────────────────────────────────────────────────────

function SeekerFace({
  card,
  matchedSet,
  onPortfolioPress,
  activePortfolioId,
}: {
  card: Extract<DiscoveryCardData, { kind: 'seeker' }>;
  matchedSet: Set<string>;
  onPortfolioPress?: (item: PortfolioItem) => void;
  activePortfolioId?: string | null;
}) {
  const subtitle = (card.headline ?? '').trim() || seekerEyebrow(card);
  return (
    <>
      {/* Header: identity left, monster mark right. */}
      <View style={styles.seekerHeader}>
        <View style={styles.seekerIdentity}>
          <Text style={styles.seekerName} numberOfLines={2}>
            {card.name.trim() || 'Someone on Ambit'}
          </Text>
          {subtitle !== '' && (
            <Text style={styles.seekerHeadline} numberOfLines={2}>{subtitle}</Text>
          )}
        </View>
        <Avatar avatarId={card.avatarId} size={110} />
      </View>

      {/* Skills — centered wrap of chips. */}
      {card.skills.length > 0 && (
        <View style={styles.skillRow}>
          {card.skills.slice(0, 6).map((s) => (
            <SkillChip key={s} label={s} matched={matchedSet.has(s.toLowerCase())} />
          ))}
        </View>
      )}

      <View style={styles.divider} />

      {/* Projects — the work they've done, scrollable in place. */}
      <ScrollView
        style={styles.projectScroll}
        contentContainerStyle={styles.projectScrollContent}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        {card.portfolio.length > 0 ? (
          card.portfolio.map((item) => (
            <ProjectRow
              key={item.id}
              item={item}
              active={activePortfolioId === item.id}
              onPress={() => onPortfolioPress?.(item)}
            />
          ))
        ) : (
          <Text style={styles.projectEmpty}>No projects added yet.</Text>
        )}
      </ScrollView>
    </>
  );
}

/// One project row: thumbnail · title + one-line description · right chevron
/// (the "this is clickable" signal). Tapping opens the PortfolioModal with the
/// full story.
function ProjectRow({
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
      style={({ pressed }) => [styles.projectRow, (pressed || active) && { opacity: 0.7 }]}
      accessibilityRole="button"
      accessibilityLabel={`Open ${item.title}`}
    >
      {item.imageUri ? (
        <Image
          source={{ uri: item.imageUri }}
          style={styles.projectThumb}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={180}
        />
      ) : (
        <LinearGradient
          colors={item.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.projectThumb}
        />
      )}
      <View style={styles.projectInfo}>
        <Text style={styles.projectRowTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.projectRowDesc} numberOfLines={3}>{item.description}</Text>
      </View>
      <CaretRight size={16} color={Brand.inkMuted} weight="bold" />
    </Pressable>
  );
}

// ─── Project face ───────────────────────────────────────────────────────────

function ProjectFace({
  card,
  matchedSet,
}: {
  card: Extract<DiscoveryCardData, { kind: 'project' }>;
  matchedSet: Set<string>;
}) {
  // Roles lead ("Looking for: Frontend, Product Design…"); projects that
  // predate roles fall back to their sought skills so the section never
  // renders empty for an active project.
  const lookingFor = card.rolesSought.length > 0 ? card.rolesSought : card.skillsSought;
  // The face scrolls: the pitch must NEVER truncate to "…", so when content
  // outgrows the fixed card the cover bleeds past the fold and a vertical
  // drag reveals the rest. The deck claims only horizontal pans, so this
  // ScrollView gets vertical gestures for free.
  return (
    <ScrollView
      style={styles.projectScrollFace}
      contentContainerStyle={styles.projectFace}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled
    >
      {/* Title + industry, centered. */}
      <View style={styles.projectTitleBlock}>
        <Text style={styles.projectTitle} numberOfLines={2}>{card.title}</Text>
        {(card.industry ?? '').trim() !== '' && (
          <Text style={styles.projectIndustry} numberOfLines={1}>{card.industry}</Text>
        )}
      </View>

      {/* Compact owner row — who it's by, without taking over the card. */}
      <View style={styles.ownerRow}>
        <Avatar avatarId={card.ownerAvatarId} size={45} />
        <Text style={styles.ownerName} numberOfLines={1}>{card.ownerName}</Text>
      </View>

      {/* Roles they're looking for. */}
      {lookingFor.length > 0 && (
        <View style={styles.lookingBlock}>
          <Text style={styles.lookingLabel}>Looking for:</Text>
          <View style={styles.lookingChips}>
            {lookingFor.slice(0, 8).map((r) => (
              <SkillChip key={r} label={r} matched={matchedSet.has(r.toLowerCase())} />
            ))}
          </View>
        </View>
      )}

      {/* The 3-sentence elevator pitch — in the signature quote treatment so
          it reads as the founder speaking, not caption copy. lines={0} =
          unclamped: the full pitch always renders (the face scrolls). */}
      {card.pitch.trim() !== '' && (
        <View style={styles.pitchBlock}>
          <VibeQuote text={card.pitch} lines={0} />
        </View>
      )}

      {/* Optional cover image — fills whatever card space is left when the
          content fits, or bleeds below the fold (scroll to reveal) when it
          doesn't. Absent image = the card simply ends at the pitch. */}
      {!!card.imageUri && (
        <View style={styles.coverWrap}>
          <Image
            source={{ uri: card.imageUri }}
            style={styles.cover}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={180}
          />
        </View>
      )}
    </ScrollView>
  );
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
  // ⋯ report/block overlay — a quiet disc on the white card.
  flagBtn: {
    position: 'absolute',
    top: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(28,27,27,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  flagBtnRight: { right: 10 },
  flagBtnLeft: { left: 10 },

  // ── Seeker header ─────────────────────────────────────────────────────────
  seekerHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
  },
  seekerIdentity: {
    flex: 1,
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  seekerName: {
    fontFamily: AmbitFont.display,
    fontSize: 30,
    color: Brand.inkPrimary,
    letterSpacing: -0.4,
  },
  seekerHeadline: {
    fontFamily: AmbitFont.medium,
    fontSize: 14,
    color: Brand.inkMuted,
  },

  // ── Skills ────────────────────────────────────────────────────────────────
  skillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  chip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(111,77,162,0.28)',
  },
  chipText: { fontFamily: AmbitFont.medium, fontSize: 12, color: Brand.selected },
  // Matched (shared) skill → selected fill + white label, mirroring the
  // selected state of the Chip atom / filter-sheet chips.
  chipMatched: { backgroundColor: Brand.selected, borderColor: Brand.selected },
  chipTextMatched: { color: Brand.inkOnBrand },

  divider: {
    alignSelf: 'center',
    width: '88%',
    height: 3,
    borderRadius: 10,
    backgroundColor: 'rgba(217,217,217,0.5)',
    marginTop: 12,
    marginBottom: 4,
  },

  // ── Seeker projects list ──────────────────────────────────────────────────
  projectScroll: { flex: 1 },
  projectScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 12,
  },
  projectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  projectThumb: {
    width: 90,
    height: 90,
    borderRadius: Radii.sm,
    backgroundColor: Brand.surface2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(28,27,27,0.10)',
  },
  projectInfo: { flex: 1, gap: 5, paddingHorizontal: 6 },
  projectRowTitle: { fontFamily: AmbitFont.bold, fontSize: 14, color: Brand.inkBody },
  projectRowDesc: { fontFamily: AmbitFont.body, fontSize: 12, lineHeight: 16, color: Brand.inkBody },
  projectEmpty: {
    fontFamily: AmbitFont.body,
    fontSize: 13,
    color: Brand.inkMuted,
    textAlign: 'center',
    marginTop: 24,
  },

  // ── Project face ──────────────────────────────────────────────────────────
  // One shared 24px content inset for every section — title, owner, roles,
  // pitch, AND the cover — so all edges align down the card.
  projectScrollFace: { flex: 1 },
  projectFace: {
    // flexGrow (not flex): short content stretches the cover to fill the
    // card; long content grows past it and scrolls.
    flexGrow: 1,
    paddingTop: 20,
    paddingBottom: 14,
    gap: 14,
  },
  projectTitleBlock: {
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 24,
  },
  projectTitle: {
    fontFamily: AmbitFont.display,
    fontSize: 30,
    color: Brand.inkPrimary,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  projectIndustry: {
    fontFamily: AmbitFont.medium,
    fontSize: 14,
    color: Brand.inkMuted,
    textAlign: 'center',
  },
  ownerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
  },
  ownerName: {
    flex: 1,
    fontFamily: AmbitFont.display,
    fontSize: 20,
    color: Brand.inkPrimary,
  },
  lookingBlock: { paddingHorizontal: 24, gap: 8 },
  lookingLabel: { fontFamily: AmbitFont.body, fontSize: 12, color: Brand.inkBody },
  lookingChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  pitchBlock: { paddingHorizontal: 24 },
  coverWrap: {
    // Grows to fill leftover card space when content is short; the minHeight
    // keeps the cover substantial when the pitch pushes it below the fold.
    flexGrow: 1,
    minHeight: 220,
    paddingHorizontal: 24,
    paddingBottom: 2,
  },
  cover: {
    flex: 1,
    minHeight: 90,
    borderRadius: Radii.sm,
    backgroundColor: Brand.surface2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(28,27,27,0.10)',
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
