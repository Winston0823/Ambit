import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Images, PaperPlaneTilt, Stack, X } from 'phosphor-react-native';
import * as Haptics from 'expo-haptics';
import { HardShadow } from '../atoms';
import { AmbitFont, Brand, Radii, Space } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { fetchPortfolioForUser } from '../../lib/portfolio';
import type { DiscoveryCardData } from '../../data/mock';

interface Props {
  card: DiscoveryCardData | null;
  onDismiss: () => void;
  onSend: (
    card: DiscoveryCardData,
    text: string,
    attachment?: { id: string; title: string } | null,
  ) => boolean | Promise<boolean>;
  onSent?: () => void;
  /// Hide the attach-a-project/portfolio affordance entirely. Used when the
  /// project is already chosen upstream (e.g. the new-chat flow picks the
  /// anchoring project first), so attaching one in the composer is redundant.
  disableAttach?: boolean;
}

interface AttachOption {
  id: string;
  label: string;
  imageUrl?: string | null;
  gradient: [string, string];
}

// Height of the solid-white tail that extends below the input and slides up
// behind the keyboard. Must exceed any keyboard height (incl. predictive bar
// + safe area) so it fully backs the keyboard once the surface lifts.
const TAIL_H = 480;
// Small gap so the input clears the keyboard's top edge.
const SURFACE_GAP = 8;

const ATTACH_GRADIENTS: [string, string][] = [
  [Brand.primary, Brand.accent],
  ['#7FB2E5', '#3E6FB0'],
  ['#E8945A', '#C2451F'],
  ['#C9A57A', Brand.seekerInk],
  ['#9FD0A8', '#3E8A5B'],
];

/// Reach-out composer — a compact bottom sheet (does NOT cover the screen).
/// From the keyboard up: the message bubble, then the attach media above it.
/// Attachments start as a collapsed stack of the sender's projects /
/// portfolio; tapping the stack expands the fan to pick a specific one.
export function ReachOutComposer({ card, onDismiss, onSend, onSent, disableAttach = false }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [phase, setPhase] = useState<'compose' | 'sending'>('compose');

  const attachMode: 'project' | 'portfolio' | null =
    card && !disableAttach ? (card.kind === 'seeker' ? 'project' : 'portfolio') : null;
  const [attachItems, setAttachItems] = useState<AttachOption[] | null>(null);
  const [selected, setSelected] = useState<AttachOption | null>(null);
  const [expanded, setExpanded] = useState(false);

  const enter        = useRef(new Animated.Value(0)).current;
  const formOpacity  = useRef(new Animated.Value(1)).current;
  const planeX       = useRef(new Animated.Value(0)).current;
  const planeY       = useRef(new Animated.Value(0)).current;
  const planeOpacity = useRef(new Animated.Value(0)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;
  const tintOpacity  = useRef(new Animated.Value(0)).current;
  // Attachments animate in AFTER the white surface has risen.
  const attachOpacity = useRef(new Animated.Value(0)).current;
  const attachRise   = useRef(new Animated.Value(14)).current;
  // Live keyboard height, animated on the keyboard's OWN timing/duration so the
  // entire surface (gradient + white tail) rises in lockstep with the keyboard
  // — one continuous surface, not a dock + a separate popping backer.
  const kbAnim = useRef(new Animated.Value(0)).current;
  // Stack→fan expansion (0 stacked, 1 fanned). Springs so the cards separate
  // with a soft, airy overshoot rather than swapping.
  const expand = useRef(new Animated.Value(0)).current;
  // Fan→attached transition (0 just-picked, 1 settled): the chosen tile lerps
  // into its slot while the label + remove control fade in.
  const selectIn = useRef(new Animated.Value(0)).current;
  // Exit of the fan on pick (0 → 1): non-picked cards drop + fade away.
  const exit = useRef(new Animated.Value(0)).current;
  const [pickingId, setPickingId] = useState<string | null>(null);
  // Horizontal start of the attached tile's lerp = the picked card's fan
  // column, so it begins where the card actually was (not the centre).
  const [pickFromX, setPickFromX] = useState(0);
  const { width: winWidth } = useWindowDimensions();

  useEffect(() => {
    if (card) {
      setText('');
      setError('');
      setPhase('compose');
      setSelected(null);
      setExpanded(false);
      formOpacity.setValue(1);
      planeX.setValue(0);
      planeY.setValue(0);
      planeOpacity.setValue(0);
      successOpacity.setValue(0);
      tintOpacity.setValue(0);
      attachOpacity.setValue(0);
      attachRise.setValue(14);
      expand.setValue(0);
      selectIn.setValue(0);
      exit.setValue(0);
      setPickingId(null);
      Animated.spring(enter, { toValue: 1, friction: 9, tension: 90, useNativeDriver: true }).start();
    } else {
      enter.setValue(0);
    }
  }, [card, enter, formOpacity, planeX, planeY, planeOpacity, successOpacity, tintOpacity, attachOpacity, attachRise, expand, selectIn, exit]);

  // Spring the stack open/closed whenever `expanded` flips. Opening uses a
  // looser spring (soft overshoot = the airy separation); closing is tighter.
  useEffect(() => {
    Animated.spring(expand, {
      toValue: expanded ? 1 : 0,
      friction: expanded ? 6 : 9,
      tension: expanded ? 64 : 90,
      useNativeDriver: true,
    }).start();
  }, [expanded, expand]);

  // Second beat: once the surface is up and the attachments have loaded, fade
  // + rise them in. Keyed on attachItems so it waits for the async load.
  useEffect(() => {
    if (card && attachMode && attachItems && attachItems.length > 0) {
      Animated.parallel([
        Animated.timing(attachOpacity, { toValue: 1, duration: 360, delay: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(attachRise, { toValue: 0, duration: 360, delay: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    }
  }, [card, attachMode, attachItems, attachOpacity, attachRise]);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvt, (e) => {
      Animated.timing(kbAnim, {
        toValue: e.endCoordinates?.height ?? 0,
        // Match the keyboard's own animation length so we rise in sync with it.
        duration: Platform.OS === 'ios' ? (e.duration || 250) : 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });
    const hide = Keyboard.addListener(hideEvt, (e) => {
      Animated.timing(kbAnim, {
        toValue: 0,
        duration: Platform.OS === 'ios' ? (e?.duration || 200) : 180,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });
    return () => { show.remove(); hide.remove(); };
  }, [kbAnim]);

  useEffect(() => {
    if (!card || !user || !attachMode) { setAttachItems(null); return; }
    setAttachItems(null);
    let cancelled = false;
    (async () => {
      if (attachMode === 'project') {
        const { data } = await supabase
          .from('projects')
          .select('id, title')
          .eq('owner_id', user.id)
          .order('created_at', { ascending: false });
        if (!cancelled) {
          setAttachItems(
            ((data ?? []) as { id: string; title: string }[]).map((p, idx) => ({
              id: p.id,
              label: p.title,
              gradient: ATTACH_GRADIENTS[idx % ATTACH_GRADIENTS.length],
            })),
          );
        }
      } else {
        const items = await fetchPortfolioForUser(user.id).catch(() => []);
        if (!cancelled) {
          setAttachItems(
            items.map((it, idx) => ({
              id: it.id,
              label: it.title,
              imageUrl: it.imageUri,
              gradient: it.gradient ?? ATTACH_GRADIENTS[idx % ATTACH_GRADIENTS.length],
            })),
          );
        }
      }
    })();
    return () => { cancelled = true; };
  }, [card, user?.id, attachMode]);

  if (!card) return null;

  const firstName =
    card.kind === 'seeker' ? card.name.split(' ')[0] : card.ownerName.split(' ')[0];
  const placeholder =
    card.kind === 'seeker'
      ? `Tell ${firstName} what caught your eye…`
      : `Tell ${firstName} why you'd be a good fit…`;

  const canSend = text.trim().length > 0;

  const handleDismiss = () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    onDismiss();
  };

  const handleSend = async () => {
    if (!canSend || phase === 'sending') return;
    setError('');
    setPhase('sending');
    setExpanded(false);
    Keyboard.dismiss();

    planeOpacity.setValue(1);
    Animated.parallel([
      Animated.timing(planeX, { toValue: 120, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(planeY, { toValue: -180, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(planeOpacity, { toValue: 0, duration: 700, delay: 240, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(formOpacity, { toValue: 0.1, duration: 360, useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(tintOpacity, { toValue: 0.18, duration: 280, useNativeDriver: true }),
        Animated.timing(tintOpacity, { toValue: 0, duration: 560, useNativeDriver: true }),
      ]),
    ]).start();

    // Projects ride along as a structured attachment (rendered as a tappable
    // project card in the thread); portfolio still rides in the text for now.
    const attachment =
      selected && attachMode === 'project' ? { id: selected.id, title: selected.label } : null;
    const refLine =
      selected && attachMode === 'portfolio' ? `\n\n📎 Sharing my work: ${selected.label}` : '';

    let ok = false;
    try {
      ok = (await onSend(card, text.trim() + refLine, attachment)) !== false;
    } catch {
      ok = false;
    }

    if (ok) {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Animated.timing(successOpacity, { toValue: 1, duration: 360, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
      setTimeout(() => onSent?.(), 850);
    } else {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      planeX.setValue(0);
      planeY.setValue(0);
      planeOpacity.setValue(0);
      successOpacity.setValue(0);
      Animated.parallel([
        Animated.timing(formOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(tintOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();
      setPhase('compose');
      setError("Couldn't send — check your connection and try again.");
    }
  };

  // The whole surface lifts by the (animated) keyboard height plus a small gap,
  // so the input rides just above the keyboard and the white tail stays flush
  // behind it. Driven entirely by kbAnim → moves as one with the keyboard.
  const surfaceLift = Animated.multiply(Animated.add(kbAnim, SURFACE_GAP), -1);

  return (
    <Modal transparent animationType="fade" visible={!!card} onRequestClose={onDismiss} statusBarTranslucent>
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, { opacity: enter }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleDismiss} />
        </Animated.View>

        {/* ONE continuous surface: [media → input → white tail]. The tail hangs
            below the screen and slides up behind the keyboard, so the gradient
            and the keyboard backer are the same element and rise together. */}
        <Animated.View
          style={[styles.surface, { opacity: enter, transform: [{ translateY: surfaceLift }] }]}
        >
          <View style={styles.content}>
            {/* Upward-fading white base over the visible content. */}
            <LinearGradient
              colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.94)', Brand.canvas]}
              locations={[0, 0.52, 0.8]}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />

          <Animated.View style={{ opacity: formOpacity }} pointerEvents={phase === 'sending' ? 'none' : 'auto'}>
            {/* Attach media — sits ABOVE the message bubble. Fades + rises in
                as a second beat, after the white surface has settled. */}
            {attachMode && attachItems !== null && attachItems.length > 0 && (
              <Animated.View style={{ opacity: attachOpacity, transform: [{ translateY: attachRise }] }}>
                {selected ? (
                  <SelectedRow
                    item={selected}
                    mode={attachMode}
                    anim={selectIn}
                    fromX={pickFromX}
                    onChange={() => { setSelected(null); setExpanded(true); }}
                    onClear={() => setSelected(null)}
                  />
                ) : (
                  <AttachTray
                    items={attachItems}
                    mode={attachMode}
                    expand={expand}
                    expanded={expanded}
                    exit={exit}
                    pickingId={pickingId}
                    onOpen={() => setExpanded(true)}
                    onPick={(it) => {
                      // Where the picked card sat horizontally in the fan, in the
                      // attached tile's frame: card centre (W/2 + off*SPREAD) minus
                      // the slot tile centre (24). The tile starts its lerp here.
                      const shown = attachItems.slice(0, 3);
                      const idx = shown.findIndex((c) => c.id === it.id);
                      const off = shown.length === 1 ? 0 : shown.length === 2 ? [-0.5, 0.5][idx] : [-1, 0, 1][idx];
                      const W = winWidth - 2 * Space.lg;
                      setPickFromX(W / 2 + (off ?? 0) * 76 - 24);
                      // Beat 1: the other cards drop + fade, chosen one hands off.
                      setPickingId(it.id);
                      exit.setValue(0);
                      Animated.timing(exit, { toValue: 1, duration: 210, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(({ finished }) => {
                        if (!finished) return;
                        // Beat 2: swap to the attached row and settle the tile in.
                        setSelected(it);
                        setExpanded(false);
                        setPickingId(null);
                        expand.setValue(0);
                        exit.setValue(0);
                        selectIn.setValue(0);
                        // Smooth lerp (not a spring) so the tile glides into the
                        // attached slot instead of snapping.
                        Animated.timing(selectIn, { toValue: 1, duration: 460, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
                      });
                    }}
                  />
                )}
              </Animated.View>
            )}

            {/* Message bubble + send — just above the keyboard. */}
            <View style={styles.inputRow}>
              <View style={styles.bubble}>
                <TextInput
                  value={text}
                  onChangeText={(t) => { setText(t); if (error) setError(''); }}
                  placeholder={placeholder}
                  placeholderTextColor={Brand.inkPlaceholder}
                  multiline
                  autoFocus
                  style={styles.bubbleInput}
                  maxLength={400}
                  editable={phase === 'compose'}
                />
              </View>
              <Pressable
                onPress={handleSend}
                disabled={!canSend || phase === 'sending'}
                style={[styles.sendCircle, !canSend && styles.sendCircleOff]}
                accessibilityRole="button"
                accessibilityLabel="Send"
              >
                <PaperPlaneTilt size={20} color={canSend ? Brand.inkOnBrand : Brand.inkPlaceholder} weight="fill" />
              </Pressable>
            </View>

            {error !== '' && <Text style={styles.errorNote}>{error}</Text>}
          </Animated.View>

            {/* Celebration overlays — scoped to the visible content. */}
            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.tint, { opacity: tintOpacity }]} />
            {phase === 'sending' && (
              <Animated.View
                pointerEvents="none"
                style={[styles.plane, { opacity: planeOpacity, transform: [{ translateX: planeX }, { translateY: planeY }, { rotate: '18deg' }] }]}
              >
                <PaperPlaneTilt size={24} color={Brand.accent} weight="fill" />
              </Animated.View>
            )}
            {phase === 'sending' && (
              <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.successWrap, { opacity: successOpacity }]}>
                <Text style={styles.successText}>Your message is on its way to {firstName}.</Text>
              </Animated.View>
            )}
          </View>

          {/* Solid-white tail below the input — hangs off-screen and slides up
              behind the keyboard as the surface lifts. One element with the
              gradient, so it can never desync from the rising surface. */}
          <View style={styles.tail} pointerEvents="none" />
        </Animated.View>
      </View>
    </Modal>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/// Animated attach tray. ONE persistent instance: `expand` (0 = tight stack,
/// 1 = fanned) drives every card's spread, lift, scale, and rotation, so on
/// press the cards glide apart with a soft spring instead of hard-swapping.
/// The single collapsed pill + "Tap to choose" cross-fade into the per-card
/// labels + caption as it opens.
function AttachTray({
  items,
  mode,
  expand,
  expanded,
  exit,
  pickingId,
  onOpen,
  onPick,
}: {
  items: AttachOption[];
  mode: 'project' | 'portfolio';
  expand: Animated.Value;
  expanded: boolean;
  exit: Animated.Value;
  pickingId: string | null;
  onOpen: () => void;
  onPick: (it: AttachOption) => void;
}) {
  const shown = items.slice(0, 3);
  const n = shown.length;
  const offs   = n === 1 ? [0] : n === 2 ? [-0.5, 0.5] : [-1, 0, 1];
  const colRot = n === 1 ? [0] : n === 2 ? [-8, 8] : [-12, 0, 12];
  const fanRot = n === 1 ? [0] : n === 2 ? [-9, 9] : [-13, 0, 13];
  const labelLift = n === 3 ? [14, 0, 8] : shown.map(() => 0);
  const SPREAD = 76;  // fanned card spacing (matches the original fan)
  const OVERLAP = 18; // collapsed: a gentle stack that still peeks

  // Fade helper: 0 below `a`, 1 at/after `b`.
  const fade = (a: number, b: number) =>
    expand.interpolate({ inputRange: [a, b], outputRange: [0, 1], extrapolate: 'clamp' });
  // Whole-tray dissolve as the pick exit plays.
  const exitFade = exit.interpolate({ inputRange: [0, 0.7], outputRange: [1, 0], extrapolate: 'clamp' });

  return (
    <View style={styles.trayWrap}>
      <Animated.View pointerEvents="none" style={[styles.glowFloor, { opacity: exitFade }]} />

      {/* Collapsed single pill — fades out as the stack opens. */}
      <Animated.View
        pointerEvents="none"
        style={[styles.trayTopPill, { opacity: expand.interpolate({ inputRange: [0, 0.45], outputRange: [1, 0], extrapolate: 'clamp' }) }]}
      >
        <View style={styles.collapsedLabel}>
          <Text style={styles.collapsedLabelText}>
            {mode === 'project' ? 'Attach a project' : 'Add a portfolio highlight'}
          </Text>
        </View>
      </Animated.View>

      <View style={styles.trayCards}>
        {shown.map((it, i) => {
          const picked = it.id === pickingId;
          const translateX = expand.interpolate({ inputRange: [0, 1], outputRange: [offs[i] * OVERLAP, offs[i] * SPREAD] });
          const baseY       = expand.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }); // airy lift
          const scale       = expand.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] });
          const rotate      = expand.interpolate({ inputRange: [0, 1], outputRange: [`${colRot[i]}deg`, `${fanRot[i]}deg`] });
          // On pick: non-picked cards drop down + fade; the picked one lifts a
          // touch and fades last as it hands off to the attached row.
          const exitY = exit.interpolate({ inputRange: [0, 1], outputRange: [0, picked ? -6 : 46] });
          const translateY = Animated.add(baseY, exitY);
          const exitOpacity = picked
            ? exit.interpolate({ inputRange: [0.45, 1], outputRange: [1, 0], extrapolate: 'clamp' })
            : exit.interpolate({ inputRange: [0, 0.8], outputRange: [1, 0], extrapolate: 'clamp' });
          return (
            <AnimatedPressable
              key={it.id}
              onPress={() => onPick(it)}
              disabled={!expanded || pickingId !== null}
              accessibilityRole="button"
              accessibilityLabel={`Attach ${it.label}`}
              style={[
                styles.trayCard,
                { zIndex: picked ? 4 : offs[i] === 0 ? 3 : 1, opacity: exitOpacity, transform: [{ translateX }, { translateY }, { rotate }, { scale }] },
              ]}
            >
              <Animated.View style={[styles.fanLabel, { marginBottom: 8 + labelLift[i], opacity: fade(0.55, 1) }]} pointerEvents="none">
                <Text style={styles.fanLabelText} numberOfLines={1}>{it.label}</Text>
              </Animated.View>
              <TileFace item={it} mode={mode} size={92} radius={22} />
            </AnimatedPressable>
          );
        })}
      </View>

      {/* Caption cross-fade: "Tap to choose" → fan caption. */}
      <View style={styles.trayCaptionWrap}>
        <Animated.Text style={[styles.collapsedHint, styles.trayCaptionAbs, { opacity: expand.interpolate({ inputRange: [0, 0.45], outputRange: [1, 0], extrapolate: 'clamp' }) }]}>
          Tap to choose
        </Animated.Text>
        <Animated.Text style={[styles.trayCaption, styles.trayCaptionAbs, { opacity: Animated.multiply(fade(0.5, 1), exitFade) }]}>
          {mode === 'project' ? 'Attach a project' : 'Share a portfolio highlight'}
        </Animated.Text>
      </View>

      {/* Collapsed: tap anywhere opens the fan. zIndex must beat the cards'
          (3/1) — in RN zIndex governs TOUCH order too, so without it the
          disabled cards swallow taps and only the gaps open the fan. Covers
          the full tray (pill → cards → caption); hitSlop adds a little more. */}
      {!expanded && (
        <Pressable
          style={[StyleSheet.absoluteFill, styles.trayOpenHit]}
          hitSlop={{ top: 40, bottom: 10, left: 56, right: 56 }}
          onPress={onOpen}
          accessibilityRole="button"
          accessibilityLabel={mode === 'project' ? 'Attach a project' : 'Add a portfolio highlight'}
        />
      )}
    </View>
  );
}

/// Chosen-attachment row — the picked tile + label + remove control. On mount
/// the tile lerps down into its slot (from the fan's larger scale) while the
/// label and remove control fade in. `anim` springs 0 → 1.
function SelectedRow({
  item,
  mode,
  anim,
  fromX,
  onChange,
  onClear,
}: {
  item: AttachOption;
  mode: 'project' | 'portfolio';
  anim: Animated.Value;
  fromX: number;
  onChange: () => void;
  onClear: () => void;
}) {
  // Tile starts at the picked card's actual fan column (fromX) and full fan
  // size (1.9× ≈ 92px), then glides into its attached slot — begins where the
  // card was, not at the centre.
  const tileScale   = anim.interpolate({ inputRange: [0, 1], outputRange: [1.9, 1] });
  const tileX       = anim.interpolate({ inputRange: [0, 1], outputRange: [fromX, 0] });
  const tileY       = anim.interpolate({ inputRange: [0, 1], outputRange: [-26, 0] });
  const tileOpacity = anim.interpolate({ inputRange: [0, 0.18], outputRange: [0, 1], extrapolate: 'clamp' });
  // Text + remove fade (and slide) in only once the tile has nearly landed.
  const textOpacity = anim.interpolate({ inputRange: [0.6, 1], outputRange: [0, 1], extrapolate: 'clamp' });
  const textX       = anim.interpolate({ inputRange: [0.6, 1], outputRange: [14, 0], extrapolate: 'clamp' });
  const xOpacity    = anim.interpolate({ inputRange: [0.72, 1], outputRange: [0, 1], extrapolate: 'clamp' });

  return (
    <View style={styles.selectedRow}>
      <Animated.View style={{ zIndex: 2, opacity: tileOpacity, transform: [{ translateX: tileX }, { translateY: tileY }, { scale: tileScale }] }}>
        <Pressable onPress={onChange} accessibilityRole="button" accessibilityLabel="Change attachment">
          <TileFace item={item} mode={mode} size={48} radius={12} />
        </Pressable>
      </Animated.View>
      <Animated.View style={[styles.selectedInfo, { opacity: textOpacity, transform: [{ translateX: textX }] }]}>
        <Text style={styles.selectedKicker}>{mode === 'project' ? 'PROJECT ATTACHED' : 'PORTFOLIO ATTACHED'}</Text>
        <Text style={styles.selectedName} numberOfLines={1}>{item.label}</Text>
      </Animated.View>
      <Animated.View style={{ opacity: xOpacity }}>
        <Pressable onPress={onClear} hitSlop={8} accessibilityLabel="Remove attachment">
          <X size={16} color={Brand.inkMuted} weight="bold" />
        </Pressable>
      </Animated.View>
    </View>
  );
}

/// A single tile face — the item's image or a glossy gradient with a glyph.
function TileFace({
  item,
  mode,
  size,
  radius,
}: {
  item: AttachOption;
  mode: 'project' | 'portfolio';
  size: number;
  radius: number;
}) {
  return (
    <HardShadow radius={radius} offset={4}>
    <View style={[styles.tileFace, { width: size, height: size * 1.18, borderRadius: radius }]}>
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={StyleSheet.absoluteFill} />
      ) : (
        <LinearGradient colors={item.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill}>
          <View style={styles.tileGlyph}>
            {mode === 'project'
              ? <Stack size={size * 0.32} color="rgba(255,255,255,0.92)" weight="fill" />
              : <Images size={size * 0.32} color="rgba(255,255,255,0.92)" weight="fill" />}
          </View>
        </LinearGradient>
      )}
      {/* Glossy top sheen — sharp highlight fading into the face. */}
      <LinearGradient
        colors={['rgba(255,255,255,0.62)', 'rgba(255,255,255,0.08)', 'rgba(255,255,255,0)']}
        locations={[0, 0.28, 0.6]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={[styles.tileRim, { borderRadius: radius }]} pointerEvents="none" />
    </View>
    </HardShadow>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrim: { backgroundColor: 'rgba(0,0,0,0.35)' },

  // ONE bottom-anchored surface. Its bottom edge hangs TAIL_H below the screen
  // (via `bottom`), so the solid-white tail sits off-screen at rest and slides
  // up behind the keyboard as the surface lifts. translateY (= keyboard height)
  // is applied in render.
  surface: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -TAIL_H,
  },
  // Visible portion: the upward-fading gradient + media + input live here.
  content: {
    paddingHorizontal: Space.lg,
    paddingTop: 48,
    paddingBottom: 16,
  },
  // Solid-white extension below the input — the keyboard backer, same surface.
  tail: { height: TAIL_H, backgroundColor: Brand.canvas },

  // ── Message bubble + send ──────────────────────────────────────────────
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginTop: 28 },
  bubble: {
    flex: 1,
    backgroundColor: Brand.surface1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 44,
    justifyContent: 'center',
  },
  bubbleInput: {
    fontFamily: AmbitFont.body,
    fontSize: 16,
    color: Brand.inkBody,
    maxHeight: 120,
    padding: 0,
  },
  sendCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendCircleOff: { opacity: 0.4 },
  errorNote: {
    fontFamily: AmbitFont.body,
    fontSize: 13,
    color: Brand.danger,
    marginTop: 8,
  },

  // ── Animated tray (stack ↔ fan) ────────────────────────────────────────
  trayWrap: { alignItems: 'center', paddingTop: 2, paddingBottom: 4 },
  // Above the cards' zIndex (3) so the whole tray is one tap target to open.
  trayOpenHit: { zIndex: 20, elevation: 20 },
  trayTopPill: { zIndex: 6, marginBottom: -6 },
  collapsedLabel: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 15,
    backgroundColor: Brand.inkPrimary,
  },
  collapsedLabelText: { fontFamily: AmbitFont.body, fontSize: 12.5, fontWeight: '700', color: Brand.inkOnBrand },
  collapsedHint: { fontFamily: AmbitFont.body, fontSize: 13, color: Brand.inkMuted },
  // Cards are absolutely centered in this box; translateX spreads them apart.
  // Height ≈ a collapsed card; expanded cards overflow upward (not clipped).
  trayCards: { width: 232, height: 96, alignSelf: 'center', position: 'relative' },
  trayCard: {
    position: 'absolute',
    bottom: 0,
    left: '50%',
    width: 92,
    marginLeft: -46,
    alignItems: 'center',
  },
  trayCaptionWrap: { height: 28, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  trayCaptionAbs: { position: 'absolute' },

  // ── Selected attachment row ────────────────────────────────────────────
  selectedRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  selectedInfo: { flex: 1 },
  selectedKicker: {
    fontFamily: AmbitFont.body,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    color: Brand.accent,
  },
  selectedName: { fontFamily: AmbitFont.body, fontSize: 15, fontWeight: '600', color: Brand.inkHigh, marginTop: 2 },

  // ── Tile face ──────────────────────────────────────────────────────────
  tileFace: {
    overflow: 'hidden',
    backgroundColor: Brand.surface2,
  },
  tileRim: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  tileGlyph: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },

  // ── Floor glow + per-card label + caption ──────────────────────────────
  glowFloor: {
    position: 'absolute',
    bottom: 34,
    width: 230,
    height: 70,
    borderRadius: 120,
    backgroundColor: 'rgba(212,180,144,0.24)',
  },
  fanLabel: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 15, backgroundColor: Brand.inkPrimary, maxWidth: 130 },
  fanLabelText: { fontFamily: AmbitFont.body, fontSize: 12.5, fontWeight: '700', color: Brand.inkOnBrand },
  trayCaption: { fontFamily: AmbitFont.body, fontSize: 19, fontWeight: '700', color: Brand.inkLabel },

  // ── Celebration ────────────────────────────────────────────────────────
  tint: { backgroundColor: Brand.primary },
  plane: { position: 'absolute', right: 28, bottom: 70 },
  successWrap: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: Space.lg },
  successText: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
    fontStyle: 'italic',
    fontSize: 18,
    color: Brand.seekerInk,
    textAlign: 'center',
    lineHeight: 26,
  },
});
