import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TextInput } from '../atoms';
import { Colors, Spacing, Typography } from '../../constants/theme';

interface InterestNoteInputProps {
  value: string;
  onChangeText: (text: string) => void;
  minLength?: number;
  maxLength?: number;
}

export function InterestNoteInput({
  value,
  onChangeText,
  minLength = 50,
  maxLength = 300,
}: InterestNoteInputProps) {
  const length = value.length;
  const isUnderMin = length > 0 && length < minLength;
  const isNearMax = length >= maxLength * 0.9;
  const isOverMax = length > maxLength;

  const counterColor = isOverMax
    ? Colors.coral
    : isNearMax
    ? Colors.coral
    : isUnderMin
    ? Colors.textTertiary
    : Colors.successGreen;

  return (
    <View style={styles.container}>
      <TextInput
        value={value}
        onChangeText={(text) => {
          if (text.length <= maxLength) onChangeText(text);
        }}
        placeholder="Hey — I'm a [your role] in [neighborhood]. Your product caught my eye because..."
        multiline
        numberOfLines={5}
        label="Write a quick note (required)"
      />
      <View style={styles.counterRow}>
        {isUnderMin && (
          <Text style={styles.hint}>{minLength - length} more characters needed</Text>
        )}
        <Text style={[styles.counter, { color: counterColor }]}>
          {length}/{maxLength}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.xs,
  },
  counterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  counter: {
    ...Typography.caption,
    marginLeft: 'auto',
  },
  hint: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
});
