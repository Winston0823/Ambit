import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Tag } from '../atoms';
import { Spacing } from '../../constants/theme';

interface SkillTagGroupProps {
  skills: string[];
  max?: number;
}

export function SkillTagGroup({ skills, max }: SkillTagGroupProps) {
  const displayed = max ? skills.slice(0, max) : skills;
  const remaining = max && skills.length > max ? skills.length - max : 0;

  return (
    <View style={styles.container}>
      {displayed.map((skill) => (
        <Tag key={skill} label={skill} />
      ))}
      {remaining > 0 && <Tag label={`+${remaining}`} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
});
