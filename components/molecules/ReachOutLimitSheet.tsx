import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { FilmSlate } from 'phosphor-react-native';
import { AmbitFont, Brand, Radii, Space } from '../../constants/theme';
import { DAILY_FREE_LIMIT, addAdBonus } from '../../lib/reachOutLimit';
import { showRewardedAd } from '../../lib/ads';
import { toast } from '../../lib/toast';

interface Props {
  visible: boolean;
  /// Reach-outs already sent today.
  used: number;
  /// Total capacity today (free + ad bonus already earned).
  limit: number;
  onDismiss: () => void;
  /// Fired after the rewarded ad completes and the bonus is recorded.
  onAdComplete: () => void;
}

/// Bottom sheet shown when the user hits their daily reach-out cap.
/// Offers a rewarded ad to unlock one more slot for the day.
///
/// Ad integration lives in `lib/ads.ts` (`showRewardedAd`): a real AdMob
/// rewarded ad in native builds, a simulated 2s ad in Expo Go / web. The bonus
/// is granted ONLY when the ad reports the reward earned.
export function ReachOutLimitSheet({
  visible,
  used,
  limit,
  onDismiss,
  onAdComplete,
}: Props) {
  const [adState, setAdState] = useState<'idle' | 'loading' | 'done'>('idle');

  const handleWatchAd = async () => {
    if (adState !== 'idle') return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setAdState('loading');

    try {
      const earned = await showRewardedAd();
      if (!earned) {
        // Closed before finishing — no reward, no bonus. Back to idle silently.
        setAdState('idle');
        return;
      }
      await addAdBonus();
      setAdState('done');
      setTimeout(() => { setAdState('idle'); onAdComplete(); }, 500);
    } catch (e) {
      console.warn('rewarded ad failed:', e);
      setAdState('idle');
      toast.error("Couldn't load an ad right now. Try again in a moment.");
    }
  };

  const dotsTotal = Math.max(limit, DAILY_FREE_LIMIT);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
    >
      <Pressable style={styles.backdrop} onPress={adState === 'idle' ? onDismiss : undefined}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />

          {/* Icon */}
          <View style={styles.iconWrap}>
            <FilmSlate size={28} color={Brand.accent} weight="fill" />
          </View>

          {/* Title + subtitle */}
          <Text style={styles.title}>Daily limit reached</Text>
          <Text style={styles.subtitle}>
            You've sent {used} of {limit} reach-outs today.
            Watch a short ad to unlock one more.
          </Text>

          {/* Progress dots */}
          <View style={styles.dotsRow}>
            {Array.from({ length: dotsTotal }).map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i < used ? styles.dotFilled : styles.dotEmpty]}
              />
            ))}
          </View>

          {/* Watch Ad CTA */}
          <Pressable
            onPress={handleWatchAd}
            disabled={adState !== 'idle'}
            style={[styles.watchBtn, adState !== 'idle' && styles.watchBtnLoading]}
            accessibilityRole="button"
            accessibilityLabel="Watch an ad to unlock a reach-out"
          >
            {adState === 'loading' ? (
              <>
                <ActivityIndicator color={Brand.inkOnBrand} size="small" />
                <Text style={styles.watchBtnText}>Ad loading…</Text>
              </>
            ) : adState === 'done' ? (
              <Text style={styles.watchBtnText}>Unlocked ✓</Text>
            ) : (
              <Text style={styles.watchBtnText}>Watch a short ad</Text>
            )}
          </Pressable>

          {/* Dismiss */}
          {adState === 'idle' && (
            <Pressable onPress={onDismiss} style={styles.dismissBtn}>
              <Text style={styles.dismissText}>Maybe later</Text>
            </Pressable>
          )}

          <View style={styles.bottomSpacer} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Brand.cardCream,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Space.lg,
    paddingTop: 12,
    alignItems: 'center',
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: Brand.borderDefault,
    marginBottom: Space.lg,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Brand.seekerSurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontFamily: AmbitFont.display,
    fontSize: 22,
    color: Brand.inkPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: AmbitFont.body,
    fontSize: 14,
    color: Brand.inkMuted,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
    marginBottom: 20,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 28,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotFilled: { backgroundColor: Brand.accent },
  dotEmpty: { backgroundColor: Brand.borderDefault },

  watchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    paddingVertical: 16,
    backgroundColor: Brand.action,
    borderRadius: Radii.sm,
    marginBottom: 12,
  },
  watchBtnLoading: { opacity: 0.75 },
  watchBtnText: {
    fontFamily: AmbitFont.body,
    fontSize: 15,
    fontWeight: '600',
    color: Brand.inkOnBrand,
  },
  dismissBtn: {
    paddingVertical: 12,
    marginBottom: 4,
  },
  dismissText: {
    fontFamily: AmbitFont.body,
    fontSize: 14,
    color: Brand.inkMuted,
  },
  bottomSpacer: { height: 24 },
});
