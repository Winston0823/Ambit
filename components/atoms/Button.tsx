import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Colors, Spacing, Radii, Typography } from '../../constants/theme';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'pill';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  style?: ViewStyle;
}

export function Button({ title, onPress, variant = 'primary', disabled = false, style }: ButtonProps) {
  const buttonStyle = variantButtonStyles[variant];
  const textStyle = variantTextStyles[variant];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      style={[styles.base, buttonStyle, disabled && styles.disabled, style]}
    >
      <Text style={[styles.text, textStyle, disabled && styles.disabledText]}>{title}</Text>
    </TouchableOpacity>
  );
}

const variantButtonStyles: Record<ButtonVariant, ViewStyle> = {
  primary: {
    backgroundColor: Colors.brandGreen,
    borderRadius: Radii.button,
  },
  secondary: {
    backgroundColor: Colors.warmGray,
    borderRadius: Radii.button,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderRadius: Radii.button,
  },
  pill: {
    backgroundColor: Colors.brandGreen,
    borderRadius: Radii.pill,
  },
};

const variantTextStyles: Record<ButtonVariant, TextStyle> = {
  primary: { color: Colors.white },
  secondary: { color: Colors.textPrimary },
  ghost: { color: Colors.brandGreen },
  pill: { color: Colors.white },
};

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    ...Typography.button,
  },
  disabled: {
    opacity: 0.4,
  },
  disabledText: {
    opacity: 0.6,
  },
});
