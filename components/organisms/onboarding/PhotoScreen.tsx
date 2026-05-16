import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackChevron } from '../../atoms';
import { OnboardingContinue } from '../../molecules';
import { useOnboarding } from '../../../context/OnboardingContext';
import { Brand, AmbitFont, Space } from '../../../constants/theme';

interface Props { onBack: () => void; onContinue: () => void; }

/// S-011 Profile Photo. Mock — taps the avatar to "set" a placeholder photo.
export function PhotoScreen({ onBack, onContinue }: Props) {
  const { profile, update } = useOnboarding();

  return (
    <SafeAreaView style={styles.root}>
      <BackChevron onPress={onBack} />
      <View style={{ height: 16 }} />

      <Text style={styles.headline}>Set up your profile</Text>
      <Text style={styles.subtitle}>A clear photo helps owners remember you.</Text>

      <View style={styles.avatarWrap}>
        <Pressable
          onPress={() => update('photoUri', profile.photoUri ? null : 'mock://photo')}
          style={styles.avatar}
        >
          {profile.photoUri ? (
            <Feather name="check" size={32} color={Brand.inkOnBrand} />
          ) : (
            <Feather name="camera" size={32} color={Brand.inkMuted} />
          )}
        </Pressable>
        <Text style={styles.avatarHelper}>
          {profile.photoUri ? 'Photo added (mock)' : 'Tap to add a photo'}
        </Text>
      </View>

      <View style={{ flex: 1 }} />

      <OnboardingContinue onPress={onContinue} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.canvas, paddingHorizontal: Space.lg },
  headline: { fontFamily: AmbitFont.display, fontSize: 30, color: Brand.inkPrimary },
  subtitle: {
    fontFamily: AmbitFont.body, fontSize: 13, color: Brand.inkMuted, marginTop: 12,
  },
  avatarWrap: { alignItems: 'center', marginTop: 80 },
  avatar: {
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: Brand.seekerSurface,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarHelper: {
    fontFamily: AmbitFont.body, fontSize: 13, color: Brand.accent,
    marginTop: 16,
  },
});
