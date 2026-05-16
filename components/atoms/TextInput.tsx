import React, { useState } from 'react';
import { View, TextInput as RNTextInput, Text, StyleSheet, TextInputProps as RNTextInputProps } from 'react-native';
import { Colors, Spacing, Radii, Typography } from '../../constants/theme';

interface TextInputProps extends Omit<RNTextInputProps, 'style'> {
  label?: string;
}

export function TextInput({ label, ...props }: TextInputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <RNTextInput
        {...props}
        style={[styles.input, focused && styles.focused, props.multiline && styles.multiline]}
        placeholderTextColor={Colors.textTertiary}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.xs + 2,
  },
  label: {
    ...Typography.label,
  },
  input: {
    backgroundColor: Colors.warmGray,
    borderRadius: Radii.input,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 4,
    fontSize: 16,
    color: Colors.textPrimary,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  focused: {
    borderColor: Colors.brandGreen,
    backgroundColor: Colors.white,
  },
  multiline: {
    minHeight: 100,
    textAlignVertical: 'top',
    paddingTop: Spacing.sm + 4,
  },
});
