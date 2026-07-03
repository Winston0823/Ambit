import React from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { Brand, Radii, AmbitFont } from '../../constants/theme';

interface Props extends TextInputProps {
  label?: string;
  multiline?: boolean;
  /// When true, applies the 16pt radius + textarea height for vibe-blurb style fields.
  textarea?: boolean;
  /// Inline validation error — red copy + red border. Takes precedence over helper.
  error?: string;
  /// Neutral inline helper / "why" copy (audit theme 3 — never a silent gate).
  helper?: string;
}

/// Single-line or multiline input field. Spec § design tokens — Input field.
export function TextField({ label, multiline, textarea, error, helper, style, ...rest }: Props) {
  const note = error || helper;
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
          error ? styles.inputError : null,
          style,
        ]}
      />
      {note ? (
        <Text style={[styles.note, error ? styles.noteError : null]}>{note}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  label: {
    // Overline: Jakarta SemiBold, uppercase, tracked, tertiary ink.
    fontFamily: AmbitFont.semibold,
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: Brand.inkLabel,
  },
  input: {
    height: 46,
    borderRadius: Radii.sm,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(111,77,162,0.28)',
    fontFamily: AmbitFont.body,
    fontSize: 14,
    color: Brand.inkBody,
  },
  textarea: {
    height: 114,
    borderRadius: Radii.sm,
    paddingTop: 16,
    paddingBottom: 16,
    fontSize: 15,
  },
  inputError: {
    borderColor: Brand.danger,
  },
  note: {
    fontFamily: AmbitFont.body,
    fontSize: 12,
    color: Brand.inkMuted,
    marginTop: 2,
  },
  noteError: {
    color: Brand.danger,
  },
});
