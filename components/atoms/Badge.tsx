import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Spacing, Radii } from '../../constants/theme';

type BadgeVariant = 'neighborhood' | 'stage' | 'status' | 'coral';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
}

const variantStyles = {
  neighborhood: { bg: Colors.badgeGreen, text: Colors.brandGreen },
  stage: { bg: Colors.badgeGray, text: Colors.textPrimary },
  status: { bg: Colors.badgeBlue, text: Colors.softBlue },
  coral: { bg: Colors.badgeCoral, text: Colors.coral },
};

export function Badge({ label, variant = 'neighborhood' }: BadgeProps) {
  const style = variantStyles[variant];

  return (
    <View style={[styles.badge, { backgroundColor: style.bg }]}>
      <Text style={[styles.text, { color: style.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs,
    borderRadius: Radii.tag,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
