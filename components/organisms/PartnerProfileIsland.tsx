import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { BlurView } from 'expo-blur';
import {
  CaretRight,
  CaretUp,
  Chat,
  FileText,
  GithubLogo,
  Globe,
  IdentificationCard,
  LinkedinLogo,
  MapPin,
} from 'phosphor-react-native';
import * as Haptics from 'expo-haptics';
import { Chip } from '../atoms';
import { StageRail } from '../molecules';
import { supabase } from '../../lib/supabase';
import { CAMPUSES } from '../../data/mock';
import {
  formatResponseRate,
  formatResponseTime,
  ConversationStatus,
  OwnerStage,
} from '../../lib/closureLoop';
import { isOnline, presenceLabel } from '../../lib/presence';
import { AmbitFont, Brand, Radii, Space, StageColor } from '../../constants/theme';

const { width: SCREEN_W } = Dimensions.get('window');

/// Collapsed state is a small dark "bubble" with the partner's pfp
/// inside — iMessage's contact-avatar look at the top of a thread. Tap
/// to morph into the full profile card.
// Hearth pill: wider glass pill with photo + name + presence row.
const PILL_W = 140;
const PILL_H = 100;
const CARD_W = SCREEN_W - 24;
const CARD_H = 560;
const AVATAR_IN_PILL_SIZE = 44;

interface Props {
  partnerId:        string | null;
  partnerName:      string;
  partnerPhotoUrl?: string | null;
  /// Partner's last-active timestamp (profiles.last_active_at). Drives the
  /// presence dot color (online vs muted) and the "Active …" subline.
  partnerLastActiveAt?: string | null;
  /// Top inset to anchor the pill's resting position below the status
  /// bar. Caller passes `paddingTop` (e.g. 6) plus any inset already
  /// applied by a SafeAreaView ancestor.
  top:              number;
  /// The conversation the user is currently viewing. We exclude it from
  /// the "Other chats with X" list and use it as the navigation anchor
  /// for sibling rows.
  currentConversationId?: string;
  /// Signed-in user id — used to query for sibling conversations in
  /// either participant orientation.
  meUserId?:        string;
  /// Shared closure-loop status of THIS conversation → the rail's top ladder.
  status:           ConversationStatus;
  /// Whether a meeting time has been agreed (lights the Meeting milestone).
  meetingAgreed:    boolean;
  /// Whether the signed-in user is the owner (gets the private draggable tag).
  isOwner:          boolean;
  /// The owner's private funnel stage for this conversation (null → 'new').
  ownerStage:       OwnerStage | null;
  /// Persist a new private stage (owner only).
  onSetStage:       (stage: OwnerStage) => void;
  /// Open the partner's discovery-card peek (full photo/vibe/skills/links).
  onOpenCard:       () => void;
}

/// One sibling conversation summary used to render the "Other chats"
/// list. Hand-typed because PostgREST returns a structurally-typed row
/// that's easier to map than to declare via supabase-gen.
interface SiblingChat {
  id:              string;
  project_title:   string;
  last_message_at: string;
  status:          'active' | 'passed' | 'hired_pending' | 'hired' | 'auto_declined';
}

/// Loadable partner-profile row. Lazy-fetched on first expand and cached
/// in state across collapses. Hand-typed columns mirror what we need to
/// render inside the expanded card.
interface PartnerProfile {
  vibe_blurb:           string | null;
  skills:               string[] | null;
  campus_id:            string | null;
  response_rate:        number | null;
  avg_response_minutes: number | null;
  github_url:           string | null;
  linkedin_url:         string | null;
  portfolio_url:        string | null;
  resume_url:           string | null;
}

/// Single Animated.View that *morphs* between a compact dark pill and a
/// large cream profile card. Apple Dynamic Island vibe — the pill and
/// the card are the same element at different dimensions, not two
/// separate views.
///
/// Two Animated.Values:
///   - `progress` (0–1) drives width/height/borderRadius/background tint.
///     useNativeDriver=false because color + layout interpolations
///     can't run on the native thread.
///   - `contentProgress` (0–1) drives crossfade between the compact
///     name layer and the expanded card layer. useNativeDriver=true.
export function PartnerProfileIsland({
  partnerId,
  partnerName,
  partnerPhotoUrl,
  partnerLastActiveAt,
  top,
  currentConversationId,
  meUserId,
  status,
  meetingAgreed,
  isOwner,
  ownerStage,
  onSetStage,
  onOpenCard,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [profile, setProfile] = useState<PartnerProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [siblings, setSiblings] = useState<SiblingChat[] | null>(null);

  const progress = useRef(new Animated.Value(0)).current;
  const contentProgress = useRef(new Animated.Value(0)).current;

  // Fetch the partner's full profile the first time the user expands.
  useEffect(() => {
    if (!expanded || !partnerId || profile || loading) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select(
          'vibe_blurb, skills, campus_id, response_rate, avg_response_minutes, github_url, linkedin_url, portfolio_url, resume_url',
        )
        .eq('id', partnerId)
        .maybeSingle();
      if (!cancelled) {
        setProfile((data as PartnerProfile | null) ?? null);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [expanded, partnerId, profile, loading]);

  // Fetch sibling conversations between (me, partner) — both
  // orientations — and surface them under "Other chats with X". Two
  // queries in parallel because the participant pair can be stored
  // owner/seeker OR seeker/owner; PostgREST doesn't let us OR across
  // two eq filters in one query cleanly.
  useEffect(() => {
    if (!expanded || !partnerId || !meUserId || siblings !== null) return;
    let cancelled = false;
    (async () => {
      const select = 'id, last_message_at, status, projects(title)';
      const [a, b] = await Promise.all([
        supabase
          .from('conversations')
          .select(select)
          .eq('owner_id',  meUserId)
          .eq('seeker_id', partnerId),
        supabase
          .from('conversations')
          .select(select)
          .eq('seeker_id', meUserId)
          .eq('owner_id',  partnerId),
      ]);
      if (cancelled) return;
      // PostgREST types a to-one embed as an array, so `projects` can come
      // back as an object OR a single-element array depending on introspection.
      // Cast through `unknown` and normalize both shapes when reading.
      const rows = [...(a.data ?? []), ...(b.data ?? [])] as unknown as Array<{
        id: string;
        last_message_at: string;
        status: SiblingChat['status'];
        projects: { title: string } | { title: string }[] | null;
      }>;
      const sibs: SiblingChat[] = rows
        .filter((r) => r.id !== currentConversationId)
        .map((r) => {
          const proj = Array.isArray(r.projects) ? r.projects[0] : r.projects;
          return {
            id:              r.id,
            project_title:   proj?.title ?? '(untitled project)',
            last_message_at: r.last_message_at,
            status:          r.status,
          };
        })
        .sort((x, y) => y.last_message_at.localeCompare(x.last_message_at));
      setSiblings(sibs);
    })();
    return () => { cancelled = true; };
  }, [expanded, partnerId, meUserId, siblings, currentConversationId]);

  // Drive the morph in two channels (layout vs content) so the inner
  // crossfade runs on the native driver while size + color stay JS-side.
  useEffect(() => {
    Animated.parallel([
      Animated.spring(progress, {
        toValue: expanded ? 1 : 0,
        friction: 8,
        tension: 80,
        useNativeDriver: false,
      }),
      Animated.timing(contentProgress, {
        toValue: expanded ? 1 : 0,
        duration: expanded ? 220 : 140,
        useNativeDriver: true,
      }),
    ]).start();
  }, [expanded, progress, contentProgress]);

  // Style interpolations. The two-tuple is `[fromCollapsed, toExpanded]`.
  // `left` interpolates alongside `width` so the pill stays horizontally
  // centered at both endpoints — at PILL_W it sits in the middle of the
  // screen; at CARD_W it hugs a 12pt margin on each side. (marginHoriz:
  // 'auto' doesn't apply to absolutely-positioned views in RN.)
  const width = progress.interpolate({ inputRange: [0, 1], outputRange: [PILL_W, CARD_W] });
  const height = progress.interpolate({ inputRange: [0, 1], outputRange: [PILL_H, CARD_H] });
  const left = progress.interpolate({
    inputRange:  [0, 1],
    outputRange: [(SCREEN_W - PILL_W) / 2, (SCREEN_W - CARD_W) / 2],
  });
  const radius = progress.interpolate({ inputRange: [0, 1], outputRange: [22, 24] });
  // Tint laid OVER the BlurView. Collapsed: a light, mostly-transparent
  // wash so the blur dominates (frosted-glass / iMessage top-bar feel).
  // Expanded: near-opaque warm cream so the profile card stays readable
  // and the blurred thread behind it doesn't bleed through the content.
  const bgColor = progress.interpolate({
    inputRange:  [0, 1],
    outputRange: ['rgba(255,255,255,0.35)', 'rgba(250,246,240,0.97)'],
  });
  const backdropOpacity = progress.interpolate({
    inputRange:  [0, 1],
    outputRange: [0, 0.35],
  });
  const collapsedOpacity = contentProgress.interpolate({
    inputRange:  [0, 0.5],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  const expandedOpacity = contentProgress.interpolate({
    inputRange:  [0.5, 1],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const campus = useMemo(
    () => CAMPUSES.find((c) => c.id === profile?.campus_id) ?? null,
    [profile?.campus_id],
  );

  const handleToggle = () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    setExpanded((open) => !open);
  };

  return (
    <>
      {/* Backdrop only intercepts taps while expanded; while collapsed
          it's invisible AND non-interactive so the chat below stays
          touchable. */}
      <Animated.View
        pointerEvents={expanded ? 'auto' : 'none'}
        style={[styles.backdrop, { opacity: backdropOpacity }]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={handleToggle} />
      </Animated.View>

      <Animated.View
        style={[
          styles.island,
          {
            top,
            left,
            width,
            height,
            borderRadius: radius,
          },
        ]}
      >
        {/* Frosted-glass backing. The BlurView blurs whatever is behind the
            island in the native view tree — i.e. the chat messages now
            scrolling under it — then the animated tint sits on top to warm
            it (light wash collapsed, opaque cream expanded). Both are
            non-interactive and clipped to the island's rounded shape via
            the parent's overflow:hidden. experimentalBlurMethod is required
            for the blur to actually render on Android. */}
        <BlurView
          tint="light"
          intensity={28}
          experimentalBlurMethod="dimezisBlurView"
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
        />
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: bgColor }]}
        />

        {/* Collapsed layer — pfp inside the dark bubble. iMessage-style
            contact avatar at the top of the thread; tap to morph into
            the full profile card. No text/caret to keep the bubble
            compact and clean. */}
        <Animated.View
          pointerEvents={expanded ? 'none' : 'auto'}
          style={[styles.collapsedLayer, { opacity: collapsedOpacity }]}
        >
          <Pressable
            onPress={handleToggle}
            style={styles.collapsedHit}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`${partnerName} profile`}
          >
            {partnerPhotoUrl ? (
              <Image source={{ uri: partnerPhotoUrl }} style={styles.pillAvatar} />
            ) : (
              <View style={[styles.pillAvatar, styles.pillAvatarFallback]}>
                <Text style={styles.pillAvatarInitial}>
                  {(partnerName ?? '?').slice(0, 1).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.pillNameRow}>
              <Text style={[styles.pillStatusDot, !isOnline(partnerLastActiveAt) && styles.pillStatusDotOff]}>●</Text>
              <Text style={styles.pillName} numberOfLines={1}>
                {(partnerName ?? '').split(' ')[0] || 'Profile'}
              </Text>
              {/* Ambient cue: the owner's private funnel-stage color. */}
              {isOwner && (
                <View style={[styles.pillStageDot, { backgroundColor: StageColor[ownerStage ?? 'new'] }]} />
              )}
            </View>
            {presenceLabel(partnerLastActiveAt) && (
              <Text style={styles.pillPresence} numberOfLines={1}>{presenceLabel(partnerLastActiveAt)}</Text>
            )}
          </Pressable>
        </Animated.View>

        {/* Expanded layer — full profile card */}
        <Animated.View
          pointerEvents={expanded ? 'auto' : 'none'}
          style={[styles.expandedLayer, { opacity: expandedOpacity }]}
        >
          <Pressable
            onPress={handleToggle}
            hitSlop={6}
            style={styles.closeBtn}
            accessibilityLabel="Close profile"
          >
            <CaretUp size={16} color={Brand.inkMuted} weight="bold" />
          </Pressable>

          <ScrollView
            contentContainerStyle={styles.cardContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Identity header — name only; the full card (photo/vibe/skills/
                links) lives in the discovery-card peek via the button below. */}
            <Text style={styles.cardName} numberOfLines={1}>{partnerName}</Text>

            {/* The island's primary content is now the conversation-stage rail:
                shared status ladder + (owner) the private draggable funnel tag. */}
            <StageRail
              status={status}
              meetingAgreed={meetingAgreed}
              isOwner={isOwner}
              ownerStage={ownerStage}
              onSetStage={onSetStage}
            />

            {/* Card icon → peek the partner's full discovery card. */}
            <Pressable
              onPress={() => { setExpanded(false); onOpenCard(); }}
              style={({ pressed }) => [styles.viewCardBtn, pressed && { opacity: 0.85 }]}
              accessibilityRole="button"
              accessibilityLabel={`View ${(partnerName ?? '').split(' ')[0] || 'their'} card`}
            >
              <IdentificationCard size={18} color={Brand.actionInk} weight="regular" />
              <Text style={styles.viewCardLabel}>
                View {(partnerName ?? '').split(' ')[0] || 'their'}'s card
              </Text>
              <CaretRight size={14} color={Brand.inkLabel} weight="regular" />
            </Pressable>

            {/* "Other chats with X" cross-link — sibling conversations
                between me and this partner anchored to different
                projects. Per-project semantics means each one is its
                own thread; this gives the user a way to hop between
                them without going back to the inbox. */}
            {siblings && siblings.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.eyebrow}>
                  OTHER CHATS WITH {partnerName.toUpperCase()}
                </Text>
                <View style={styles.siblingColumn}>
                  {siblings.map((sib) => (
                    <Pressable
                      key={sib.id}
                      onPress={() => {
                        setExpanded(false);
                        router.replace({
                          pathname: '/chat/[id]',
                          params: { id: sib.id },
                        });
                      }}
                      style={({ pressed }) => [
                        styles.siblingRow,
                        pressed && { opacity: 0.85 },
                      ]}
                    >
                      <View style={styles.siblingText}>
                        <Text style={styles.siblingTitle} numberOfLines={1}>
                          {sib.project_title}
                        </Text>
                        <Text style={styles.siblingMeta}>
                          {siblingStatusLabel(sib.status)}
                          {' · '}
                          {formatSiblingTime(sib.last_message_at)}
                        </Text>
                      </View>
                      <CaretRight size={14} color={Brand.inkLabel} weight="regular" />
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </>
  );
}

/// Short human label for a sibling chat's status. Distinct from the
/// thread header banner since this is meta-context, not a primary state.
function siblingStatusLabel(status: SiblingChat['status']): string {
  switch (status) {
    case 'active':        return 'Active';
    case 'hired':         return 'Hired';
    case 'hired_pending': return 'Pending hire';
    case 'passed':        return 'Passed';
    case 'auto_declined': return 'Auto-declined';
    default:              return '';
  }
}

/// "Now / 12m / 3h / 2d / Mar 14" — same cadence as the inbox row's
/// relative timestamp.
function formatSiblingTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const sec = Math.floor((now - then) / 1000);
  if (sec < 60)    return 'now';
  if (sec < 3600)  return `${Math.floor(sec / 60)}m`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
  const days = Math.floor(sec / 86400);
  if (days < 7)    return `${days}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ─── ProofLink (copied from profile.tsx to keep the island self-contained) ──

function ProofLink({
  Icon,
  label,
  url,
}: {
  Icon: React.ComponentType<{ size: number; color: string; weight?: 'regular' | 'fill' }>;
  label: string;
  url: string | null | undefined;
}) {
  const hasUrl = !!url && url.trim().length > 0;
  return (
    <View style={[styles.proofRow, !hasUrl && styles.proofRowMuted]}>
      <Icon size={18} color={hasUrl ? Brand.seekerInk : Brand.inkPlaceholder} weight="regular" />
      <View style={styles.proofText}>
        <Text style={styles.proofLabel}>{label}</Text>
        {hasUrl ? (
          <Text style={styles.proofUrl} numberOfLines={1}>{url}</Text>
        ) : (
          <Text style={styles.proofUrlMuted}>Not added</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Brand.inkEdge,
    zIndex: 20,
  },

  // The island itself — absolutely positioned, centered horizontally.
  // Crisp ink border instead of the retired glass shadow — a HardShadow
  // wrapper is impractical on an absolutely-positioned, size-animating view.
  island: {
    position: 'absolute',
    overflow: 'hidden',
    zIndex: 30,
    borderWidth: 1.5,
    borderColor: Brand.inkEdge,
  },

  // Collapsed pill content — Hearth direction. Glassy pill with photo
  // on the left, partner first-name + presence on the right. Wider
  // (200pt) than the previous pfp-only bubble.
  collapsedLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Vertical-stack pill: avatar centered on top, "● Name" centered below.
  // Compact (140×78) so it reads as a contact chip rather than a header bar.
  collapsedHit: {
    width: '100%',
    height: '100%',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    paddingBottom: 8,
    gap: 4,
  },
  pillAvatar: {
    width: AVATAR_IN_PILL_SIZE,
    height: AVATAR_IN_PILL_SIZE,
    borderRadius: 13,
  },
  pillAvatarFallback: {
    backgroundColor: Brand.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillAvatarInitial: {
    fontFamily: AmbitFont.display,
    fontSize: 22,
    color: Brand.inkLabel,
  },
  pillNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pillStatusDot: {
    fontFamily: AmbitFont.body,
    fontSize: 10,
    color: Brand.actionDeep,
    lineHeight: 14,
  },
  pillName: {
    fontFamily: AmbitFont.body,
    fontSize: 15,
    fontWeight: '700',
    color: Brand.inkPrimary,
    letterSpacing: -0.1,
  },
  pillStatusDotOff: { color: Brand.inkMuted },
  pillPresence: {
    fontFamily: AmbitFont.body,
    fontSize: 10,
    fontWeight: '600',
    color: Brand.inkMuted,
    letterSpacing: 0.1,
  },

  // Expanded card content
  expandedLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brand.surface1,
    zIndex: 1,
  },
  cardContent: {
    paddingHorizontal: Space.lg,
    paddingTop: 24,
    paddingBottom: Space.lg,
    gap: Space.lg,
  },
  cardName: {
    fontFamily: AmbitFont.display,
    fontSize: 22,
    color: Brand.inkPrimary,
  },
  pillStageDot: {
    width: 7, height: 7, borderRadius: 3.5, marginLeft: 6,
  },
  viewCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: Radii.md,
    backgroundColor: Brand.surface1,
    borderWidth: 1.5,
    borderColor: Brand.borderDefault,
  },
  viewCardLabel: {
    flex: 1,
    fontFamily: AmbitFont.body,
    fontSize: 14,
    fontWeight: '600',
    color: Brand.inkBody,
  },

  // Vertical contact-card hero: bubble → tail-down → photo → name → meta.
  heroStack: {
    alignItems: 'center',
    gap: 8,
  },
  heroBubble: {
    maxWidth: '90%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: Brand.seekerSurface,
  },
  heroBubbleText: {
    fontFamily: AmbitFont.body,
    fontSize: 13,
    color: Brand.seekerInk,
    lineHeight: 18,
    textAlign: 'center',
  },
  // Tail = downward-pointing triangle. Classic three-bordered View trick.
  heroBubbleTail: {
    width: 0,
    height: 0,
    marginTop: -2,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: Brand.seekerSurface,
  },
  heroAvatarWrap: {
    width: 96,
    height: 96,
    marginTop: 2,
  },
  heroAvatar: {
    width: 96,
    height: 96,
    borderRadius: 20,
  },
  heroAvatarFallback: {
    backgroundColor: Brand.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroAvatarInitial: {
    fontFamily: AmbitFont.display,
    fontSize: 36,
    color: Brand.inkLabel,
  },
  heroName: {
    fontFamily: AmbitFont.display,
    fontSize: 22,
    color: Brand.seekerInk,
    textAlign: 'center',
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  heroMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heroMetaText: {
    fontFamily: AmbitFont.body,
    fontSize: 12,
    color: Brand.inkLabel,
  },
  responseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: Brand.surface1,
  },
  responseBadgeText: {
    fontFamily: AmbitFont.body,
    fontSize: 11,
    fontWeight: '600',
    color: Brand.accent,
    letterSpacing: 0.2,
  },

  section: { gap: 12 },
  eyebrow: {
    fontFamily: AmbitFont.body,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
    color: Brand.inkLabel,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  linkColumn: { gap: 8 },

  // Sibling-chat cross-link rows. Visually distinct from the proof
  // links (warm-tan tint, no icon column) so the section reads as
  // "navigation between threads" rather than "more external info".
  siblingColumn: { gap: 8 },
  siblingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: Brand.seekerSurface,
    borderRadius: Radii.md,
    gap: 12,
  },
  siblingText: { flex: 1 },
  siblingTitle: {
    fontFamily: AmbitFont.body,
    fontSize: 14,
    fontWeight: '600',
    color: Brand.seekerInk,
  },
  siblingMeta: {
    fontFamily: AmbitFont.body,
    fontSize: 11,
    color: Brand.inkLabel,
    marginTop: 2,
  },
  proofRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: Brand.surface1,
    borderRadius: Radii.md,
  },
  proofRowMuted: { opacity: 0.6 },
  proofText: { flex: 1 },
  proofLabel: {
    fontFamily: AmbitFont.body,
    fontSize: 12,
    fontWeight: '600',
    color: Brand.inkLabel,
    letterSpacing: 0.2,
  },
  proofUrl: {
    fontFamily: AmbitFont.body,
    fontSize: 13,
    color: Brand.inkBody,
    marginTop: 1,
  },
  proofUrlMuted: {
    fontFamily: AmbitFont.body,
    fontSize: 13,
    color: Brand.inkPlaceholder,
    marginTop: 1,
  },
});
