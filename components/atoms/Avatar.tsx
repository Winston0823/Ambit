import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Brand } from '../../constants/theme';

/// The 12 bundled monster marks. Keys are persisted in profiles.avatar_id —
/// never rename without a data migration.
const AVATAR_MAP: Record<string, number> = {
  'monster-01': require('../../assets/avatars/monster-01.png'),
  'monster-02': require('../../assets/avatars/monster-02.png'),
  'monster-03': require('../../assets/avatars/monster-03.png'),
  'monster-04': require('../../assets/avatars/monster-04.png'),
  'monster-05': require('../../assets/avatars/monster-05.png'),
  'monster-06': require('../../assets/avatars/monster-06.png'),
  'monster-07': require('../../assets/avatars/monster-07.png'),
  'monster-08': require('../../assets/avatars/monster-08.png'),
  'monster-09': require('../../assets/avatars/monster-09.png'),
  'monster-10': require('../../assets/avatars/monster-10.png'),
  'monster-11': require('../../assets/avatars/monster-11.png'),
  'monster-12': require('../../assets/avatars/monster-12.png'),
};

export const AVATAR_IDS = Object.keys(AVATAR_MAP) as readonly string[];

export function avatarSource(avatarId: string | null | undefined): number {
  return AVATAR_MAP[avatarId ?? ''] ?? AVATAR_MAP['monster-01'];
}

export function randomAvatarId(): string {
  return AVATAR_IDS[Math.floor(Math.random() * AVATAR_IDS.length)];
}

interface Props {
  avatarId: string | null | undefined;
  /// Only revealed contexts pass this — a URL returned by fetch_peer_photos.
  photoUrl?: string | null;
  size: number;
}

/// The single identity visual. Photo when revealed, monster mark otherwise.
export function Avatar({ avatarId, photoUrl, size }: Props) {
  const radius = size / 2;
  if (photoUrl) {
    return (
      <Image
        source={{ uri: photoUrl }}
        style={{ width: size, height: size, borderRadius: radius }}
        cachePolicy="memory-disk"
        transition={180}
      />
    );
  }
  const inset = Math.round(size * 0.12);
  return (
    <View style={[styles.tile, { width: size, height: size, borderRadius: radius }]}>
      <Image
        source={avatarSource(avatarId)}
        style={{ width: size - inset * 2, height: size - inset * 2 }}
        contentFit="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    backgroundColor: Brand.seekerSurface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
