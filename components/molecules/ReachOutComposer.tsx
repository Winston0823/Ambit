import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { PaperPlaneTilt, X } from 'phosphor-react-native';
import * as Haptics from 'expo-haptics';
import {
  AmbitFont,
  Brand,
  Radii,
  Space,
  TypeScale,
} from '../../constants/theme';
import type { DiscoveryCardData } from '../../data/mock';

interface Props {
  /// The card the composer is targeting. Null = closed. The composer uses
  /// the card's kind + display name to personalize the placeholder
  /// ("Tell Alex what caught your eye…" vs "Tell Noah why you'd be a good fit…")
  card: DiscoveryCardData | null;
  /// Dismiss without sending. Fires when the user taps the scrim or the X.
  onDismiss: () => void;
  /// Perform the send. Returns true on success, false on failure. The
  /// composer withholds the "on its way" affirmation until this resolves,
  /// so the celebration can never claim success for a send that failed.
  /// Should NOT dismiss/navigate — do that in onSent.
  onSend: (card: DiscoveryCardData, text: string) => boolean | Promise<boolean>;
  /// Fired once a send has SUCCEEDED and its affirmation has shown. Parent
  /// dismisses or navigates here (kept separate from onSend so commitment
  /// to "sent" only happens after the network confirms).
  onSent?: () => void;
}

/// Modal composer that replaces the swipe-up gesture. Triggered by the
/// "Reach out" button pinned to the bottom of each discovery card.
///
/// Same visual contract as the prior inline composer (header + textarea +
/// warm-tan send pill), now rendered as a bottom sheet so the underlying
/// card stays still while the user types. Solves the conflict between
/// card-internal scroll and the swipe-up gesture.
export function ReachOutComposer({ card, onDismiss, onSend, onSent }: Props) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  /// 'compose' = normal form. 'sending' = the user just hit Send and we're
  /// running the celebration choreography. After ~1200ms in 'sending' we
  /// fire `onSend` (parent then dismisses), so the user sees the paper
  /// plane fly off + the "on its way" line before returning to the deck.
  const [phase, setPhase] = useState<'compose' | 'sending'>('compose');

  // Sheet entry — same as PortfolioModal so the system feels coherent.
  const scrimOpacity = useRef(new Animated.Value(0)).current;
  const sheetY       = useRef(new Animated.Value(40)).current;
  const sheetOpacity = useRef(new Animated.Value(0)).current;

  // Celebration — driven from handleSend. The plane detaches from the
  // send button and flies up-right off-screen; the form fades to a
  // memory; the "on its way" line fades in at center; a subtle brand-tan
  // tint sweeps across the sheet to celebrate.
  const planeX        = useRef(new Animated.Value(0)).current;
  const planeY        = useRef(new Animated.Value(0)).current;
  const planeRotate   = useRef(new Animated.Value(0)).current;
  const planeOpacity  = useRef(new Animated.Value(1)).current;
  const formOpacity   = useRef(new Animated.Value(1)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;
  const tintOpacity   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (card) {
      setText('');
      setError('');
      setPhase('compose');
      // Reset all celebration values so reopening the composer is clean.
      planeX.setValue(0);
      planeY.setValue(0);
      planeRotate.setValue(0);
      planeOpacity.setValue(1);
      formOpacity.setValue(1);
      successOpacity.setValue(0);
      tintOpacity.setValue(0);

      Animated.parallel([
        Animated.timing(scrimOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(sheetY,  { toValue: 0, friction: 8, tension: 110, useNativeDriver: true }),
        Animated.timing(sheetOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    } else {
      scrimOpacity.setValue(0);
      sheetY.setValue(40);
      sheetOpacity.setValue(0);
    }
  }, [card, scrimOpacity, sheetY, sheetOpacity,
      planeX, planeY, planeRotate, planeOpacity,
      formOpacity, successOpacity, tintOpacity]);

  if (!card) return null;

  // Personalized placeholder. Same logic as the prior inline composer —
  // first-name of the recipient, framing depends on which side initiates.
  const firstName =
    card.kind === 'seeker'
      ? card.name.split(' ')[0]
      : card.ownerName.split(' ')[0];
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
    Keyboard.dismiss();

    // ── Optimistic "launch" — reads as *sending*, not *sent* ──
    // Paper plane lifts off the button, the form recedes, and a brand-tan
    // tint sweeps the sheet. The italic "on its way" affirmation below is
    // deliberately withheld until the network confirms (see the await), so
    // the celebration can never claim success for a send that failed.
    Animated.parallel([
      Animated.timing(planeX, { toValue: 220, duration: 720, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(planeY, { toValue: -260, duration: 720, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(planeRotate, { toValue: 1, duration: 720, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(planeOpacity, { toValue: 0, duration: 720, delay: 280, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(formOpacity, { toValue: 0.12, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(tintOpacity, { toValue: 0.22, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(tintOpacity, { toValue: 0, duration: 540, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      ]),
    ]).start();

    let ok = false;
    try {
      ok = (await onSend(card, text.trim())) !== false;
    } catch {
      ok = false;
    }

    if (ok) {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      // Network confirmed — now show the affirmation, then hand off so the
      // parent dismisses or navigates into the new thread.
      Animated.timing(successOpacity, {
        toValue: 1,
        duration: 380,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      setTimeout(() => onSent?.(), 850);
    } else {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      }
      // Send failed — reverse the launch and return to the form with an
      // inline error so the user can edit and retry.
      planeX.setValue(0);
      planeY.setValue(0);
      planeRotate.setValue(0);
      planeOpacity.setValue(1);
      successOpacity.setValue(0);
      Animated.parallel([
        Animated.timing(formOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(tintOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();
      setPhase('compose');
      setError("Couldn't send — check your connection and try again.");
    }
  };

  // Convert the planeRotate 0→1 driver into a degree value for the icon.
  const planeRotateDeg = planeRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '24deg'],
  });

  return (
    <Modal
      transparent
      animationType="none"
      visible={!!card}
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.root}
      >
        <Animated.View style={[styles.scrimWrap, { opacity: scrimOpacity }]}>
          <Pressable style={styles.scrim} onPress={handleDismiss} />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            { opacity: sheetOpacity, transform: [{ translateY: sheetY }] },
          ]}
        >
          {/* Form — fades back when the celebration kicks off. */}
          <Animated.View style={{ opacity: formOpacity }} pointerEvents={phase === 'sending' ? 'none' : 'auto'}>
            <View style={styles.header}>
              <Text style={styles.title}>Say hi</Text>
              <Pressable
                onPress={handleDismiss}
                hitSlop={10}
                accessibilityLabel="Cancel"
              >
                <X size={20} color={Brand.inkMuted} weight="bold" />
              </Pressable>
            </View>

            <TextInput
              value={text}
              onChangeText={(t) => { setText(t); if (error) setError(''); }}
              placeholder={placeholder}
              placeholderTextColor={Brand.inkPlaceholder}
              multiline
              autoFocus
              style={styles.input}
              maxLength={400}
              editable={phase === 'compose'}
            />

            {error !== '' && <Text style={styles.errorNote}>{error}</Text>}

            <View style={styles.actions}>
              <Pressable
                onPress={handleSend}
                disabled={!canSend || phase === 'sending'}
                style={({ pressed }) => [
                  styles.sendBtn,
                  !canSend && styles.sendBtnDisabled,
                  pressed && canSend && { opacity: 0.9 },
                ]}
              >
                {/* The icon inside the button stays hidden during flight
                    so it doesn't double up with the detached flying plane. */}
                <Animated.View style={{ opacity: phase === 'sending' ? 0 : 1 }}>
                  <PaperPlaneTilt size={16} color={Brand.inkOnBrand} weight="fill" />
                </Animated.View>
                <Text style={styles.sendLabel}>Send</Text>
              </Pressable>
            </View>
          </Animated.View>

          {/* Brand-tan tint sweep — peaks ~360ms into the celebration,
              then dissolves. Subtle warmth, not a flash. */}
          <Animated.View
            pointerEvents="none"
            style={[styles.tintSweep, { opacity: tintOpacity }]}
          />

          {/* Detached flying paper plane — anchored at the send button's
              original glyph position (bottom-right of the sheet) so the
              "icon flies off the button" effect reads correctly. */}
          {phase === 'sending' && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.flyingPlane,
                {
                  opacity: planeOpacity,
                  transform: [
                    { translateX: planeX },
                    { translateY: planeY },
                    { rotate: planeRotateDeg },
                  ],
                },
              ]}
            >
              <PaperPlaneTilt size={22} color={Brand.accent} weight="fill" />
            </Animated.View>
          )}

          {/* "On its way to {firstName}" — fades in after the plane
              has launched, sits at the center of the sheet area. */}
          {phase === 'sending' && (
            <Animated.View
              pointerEvents="none"
              style={[styles.successLine, { opacity: successOpacity }]}
            >
              <Text style={styles.successText}>
                Your message is on its way to {firstName}.
              </Text>
            </Animated.View>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrimWrap: {
    ...StyleSheet.absoluteFillObject,
  },
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },

  sheet: {
    backgroundColor: Brand.canvas,
    borderTopLeftRadius: Radii.lg + 4,
    borderTopRightRadius: Radii.lg + 4,
    padding: Space.lg,
    paddingBottom: Space.lg + 8,
    gap: 14,
    // iOS shadow
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: -8 },
    shadowRadius: 24,
    // Android elevation
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: AmbitFont.display,
    fontSize: 20,
    color: Brand.inkPrimary,
  },
  input: {
    minHeight: 96,
    maxHeight: 180,
    fontFamily: AmbitFont.body,
    fontSize: 16,
    color: Brand.inkBody,
    backgroundColor: Brand.surface1,
    borderRadius: Radii.md,
    padding: 14,
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: Radii.md,
    backgroundColor: Brand.primary,
  },
  sendBtnDisabled: { opacity: 0.45 },
  sendLabel: {
    ...TypeScale.title,
    fontSize: 15,
    color: Brand.inkOnBrand,
  },
  errorNote: {
    fontFamily: AmbitFont.body,
    fontSize: 13,
    color: '#C0392B',
    marginTop: -4,
  },

  // ── Celebration overlays (phase === 'sending') ────────────────────────
  // Warm brand-tan tint that pulses across the sheet on send. Sits above
  // the form layer but below the flying plane + success line.
  tintSweep: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Brand.primary,
    borderTopLeftRadius: Radii.lg + 4,
    borderTopRightRadius: Radii.lg + 4,
  },
  // Flying paper plane — anchored at approximately the send button's
  // PaperPlaneTilt icon position. Sheet padding is Space.lg (24) from
  // each edge; the icon sits inside the button at ~28px in from the
  // sheet's right padding edge, and ~28px up from the sheet's bottom
  // padding. Tuned visually so it appears to launch from the button.
  flyingPlane: {
    position: 'absolute',
    right: 60,
    bottom: 38,
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // "On its way to Alex" — centered Fraunces italic over the form area.
  successLine: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Space.lg,
  },
  successText: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
    fontStyle: 'italic',
    fontSize: 19,
    color: Brand.seekerInk,
    textAlign: 'center',
    lineHeight: 26,
    letterSpacing: -0.2,
  },
});
