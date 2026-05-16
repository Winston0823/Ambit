import React, { ReactNode } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { Colors, Spacing, Typography } from '../../constants/theme';

interface ProfileTemplateProps {
  title: string;
  children: ReactNode;
}

export function ProfileTemplate({ title, children }: ProfileTemplateProps) {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>{title}</Text>
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.warmWhite,
  },
  content: {
    padding: Spacing.screen,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.md,
  },
  title: {
    ...Typography.heading,
    marginBottom: Spacing.sm,
  },
});
