import React from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import type { IconProps } from 'phosphor-react-native';
import { BackChevron, Entrance } from '../../atoms';
import { Brand, AmbitFont, Space } from '../../../constants/theme';

type PhosphorIcon = React.ComponentType<IconProps>;

interface Props {
  /// Display headline. Supports embedded "\n" for manual line breaks.
  headline: string;
  /// Small-caps eyebrow above the headline (editorial orientation cue).
  kicker?: string;
  subtitle?: string;
  /// Large low-opacity Phosphor motif that bleeds off the upper-right edge,
  /// giving each screen a quiet graphic identity without competing with the
  /// content. (Standardizes the pattern EduEmailScreen pioneered.)
  watermarkIcon?: PhosphorIcon;
  /// Renders a BackChevron when provided.
  onBack?: () => void;
  /// Pinned footer (typically <OnboardingContinue/>). Rendered inside the
  /// scaffold root so its absolute bottom anchoring is unchanged.
  footer?: React.ReactNode;
  /// Subtle cream wash behind everything. On by default.
  wash?: boolean;
  children?: React.ReactNode;
}

/// Shared composition for onboarding gate screens. Locks a single vertical
/// rhythm — watermark, kicker, bold display headline, subtitle, then a
/// flexible body — so the headline lands at the same baseline on every
/// screen and the slide between steps reads as one continuous space.
export function OnboardingScaffold({
  headline,
  kicker,
  subtitle,
  watermarkIcon: Watermark,
  onBack,
  footer,
  wash = true,
  children,
}: Props) {
  return (
    <SafeAreaView style={styles.root}>
      {wash && (
        <LinearGradient
          colors={[Brand.canvas, Brand.cardCream]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      )}

      {Watermark && (
        <View style={styles.watermark} pointerEvents="none">
          <Watermark size={360} color={Brand.actionDeep} weight="duotone" />
        </View>
      )}

      {onBack && <BackChevron onPress={onBack} />}

      {/* KeyboardAvoidingView lifts the header/body AND the absolutely-anchored
          footer (it's the footer's positioning parent) so the CTA and lower
          fields never hide behind the keyboard — the root cause the audit
          flagged for VibeBlurb/ProofLinks/EduEmail/SignIn (theme 2). */}
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          {kicker ? (
            <Entrance index={0}>
              <Text style={styles.kicker}>{kicker}</Text>
            </Entrance>
          ) : null}
          <Entrance index={kicker ? 1 : 0}>
            <Text style={styles.headline}>{headline}</Text>
          </Entrance>
          {subtitle ? (
            <Entrance index={kicker ? 2 : 1}>
              <Text style={styles.subtitle}>{subtitle}</Text>
            </Entrance>
          ) : null}
        </View>

        <View style={styles.body}>{children}</View>

        {footer}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.canvas },
  kav: { flex: 1 },
  watermark: {
    position: 'absolute',
    top: 110,
    right: -90,
    opacity: 0.08,
  },
  header: {
    paddingHorizontal: Space.lg,
    marginTop: 40,
    marginBottom: Space.lg,
  },
  kicker: {
    fontFamily: AmbitFont.body,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: Brand.actionDeep,
    marginBottom: 12,
  },
  headline: {
    fontFamily: AmbitFont.display,
    fontSize: 34,
    color: Brand.inkPrimary,
    lineHeight: 40,
  },
  subtitle: {
    fontFamily: AmbitFont.body,
    fontSize: 14,
    color: Brand.inkMuted,
    marginTop: 12,
    lineHeight: 20,
  },
  body: { flex: 1 },
});
