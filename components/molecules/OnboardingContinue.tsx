import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '../atoms';
import { Space } from '../../constants/theme';

interface Props {
  title?: string;
  onPress: () => void;
  disabled?: boolean;
}

/// Anchored bottom CTA for onboarding screens.
/// Spec anchor: y = 772px on 874-height screen (102px from bottom).
export function OnboardingContinue({ title = 'Continue', onPress, disabled = false }: Props) {
  return (
    <View style={styles.wrap}>
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
    paddingHorizontal: Space.lg,
    paddingBottom: Space.ctaBottom,
  },
});
