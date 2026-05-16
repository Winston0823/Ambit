import React from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { Brand, Radii, AmbitFont } from '../../constants/theme';

interface Props extends TextInputProps {
  label?: string;
  multiline?: boolean;
  /// When true, applies the 16pt radius + textarea height for vibe-blurb style fields.
  textarea?: boolean;
}

/// Single-line or multiline input field. Spec § design tokens — Input field.
export function TextField({ label, multiline, textarea, style, ...rest }: Props) {
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        {...rest}
        multiline={multiline || textarea}
        textAlignVertical={(multiline || textarea) ? 'top' : 'center'}
        placeholderTextColor={Brand.inkPlaceholder}
        style={[
          styles.input,
          textarea && styles.textarea,
          style,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  label: {
    fontFamily: AmbitFont.body,
    fontSize: 16,
    color: Brand.inkPrimary,
  },
  input: {
    height: 46,
    borderRadius: Radii.md,
    paddingHorizontal: 14,
    backgroundColor: Brand.surface1,
    borderWidth: 1.5,
    borderColor: Brand.borderDefault,
    fontFamily: AmbitFont.body,
    fontSize: 14,
    color: Brand.inkBody,
  },
  textarea: {
    height: 114,
    borderRadius: Radii.lg,
    paddingTop: 14,
    paddingBottom: 14,
    fontSize: 15,
  },
});
