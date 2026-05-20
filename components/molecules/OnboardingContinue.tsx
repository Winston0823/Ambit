import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../atoms';
import { Space } from '../../constants/theme';

interface Props {
  title?: string;
  onPress: () => void;
  disabled?: boolean;
}

/// Continue button for onboarding screens.
///
/// Absolute-positioned at a fixed offset above the safe-area bottom inset
/// so the button lands at the SAME y-coordinate on every screen — no
/// matter what the layout above it is doing. Screens that scroll need to
/// pad their content with `insets.bottom + 130` so the anchored button
/// doesn't cover the bottom of their list.
export const ANCHORED_CTA_BOTTOM = 24;     // pt above safe-area bottom
export const ANCHORED_CTA_HEIGHT = 52;     // matches Button minHeight

export function OnboardingContinue({
  title = 'Continue',
  onPress,
  disabled = false,
}: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.wrap,
        { bottom: insets.bottom + ANCHORED_CTA_BOTTOM },
      ]}
    >
      <Button
        title={title}
        onPress={onPress}
        disabled={disabled}
        trailingArrow
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: Space.lg,
    right: Space.lg,
  },
});
