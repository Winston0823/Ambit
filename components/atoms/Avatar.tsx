import React, { useState } from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';
import { Colors, Radii } from '../../constants/theme';

type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps {
  uri?: string;
  name: string;
  size?: AvatarSize;
}

const sizeMap: Record<AvatarSize, number> = {
  sm: 36,
  md: 48,
  lg: 64,
  xl: 96,
};

const fontSizeMap: Record<AvatarSize, number> = {
  sm: 14,
  md: 18,
  lg: 24,
  xl: 36,
};

const initialsColors = [
  '#1A6B4F', '#2563EB', '#D85A30', '#7C3AED',
  '#DC2626', '#059669', '#D97706', '#4F46E5',
];

function getInitials(name: string): string {
  const parts = name.split(' ').filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0]?.[0]?.toUpperCase() ?? '?';
}

function getColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return initialsColors[Math.abs(hash) % initialsColors.length];
}

export function Avatar({ uri, name, size = 'md' }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const dimension = sizeMap[size];

  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        style={[styles.image, { width: dimension, height: dimension, borderRadius: dimension / 2 }]}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        { width: dimension, height: dimension, borderRadius: dimension / 2, backgroundColor: getColor(name) },
      ]}
    >
      <Text style={[styles.initials, { fontSize: fontSizeMap[size] }]}>{getInitials(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: Colors.warmGray,
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: Colors.white,
    fontWeight: '600',
  },
});
