import React, { useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { BackChevron, KeyboardDismiss } from '../../atoms';
import { OnboardingContinue } from '../../molecules';
import { useOnboarding } from '../../../context/OnboardingContext';
import { Brand, AmbitFont, Radii, Space } from '../../../constants/theme';

interface Props { onBack: () => void; onContinue: () => void; }

/// S-011 Profile Photo + Name. Per Figma node 18:441:
///   - 280×280 circular avatar at top
///   - "First + Last Name" text input below
///   - Anchored Continue at bottom
/// Tapping the avatar opens an action sheet (Camera / Photo Library / Cancel).
export function PhotoScreen({ onBack, onContinue }: Props) {
  const { profile, update } = useOnboarding();
  const [name, setName] = useState('');

  const pickFromLibrary = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Permission needed', 'Allow Photos access in Settings to choose a profile photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      update('photoUri', result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Permission needed', 'Allow Camera access in Settings to take a profile photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      update('photoUri', result.assets[0].uri);
    }
  };

  const openPicker = () => {
    Alert.alert(
      'Profile photo',
      'Pick how you want to add a photo',
      [
        { text: 'Take photo', onPress: takePhoto },
        { text: 'Choose from library', onPress: pickFromLibrary },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  const isValid = name.trim().length > 1;

  return (
    <KeyboardDismiss>
      <SafeAreaView style={styles.root}>
        <BackChevron onPress={onBack} />

        <View style={styles.content}>
          <Text style={styles.headline}>Set up your profile</Text>

          <Pressable onPress={openPicker} style={styles.avatarBtn}>
            {profile.photoUri ? (
              <Image source={{ uri: profile.photoUri }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Feather name="camera" size={36} color={Brand.accent} />
                <Text style={styles.avatarLabel}>Tap to add a photo</Text>
              </View>
            )}
          </Pressable>

          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="First + Last Name"
            placeholderTextColor={Brand.inkPlaceholder}
            autoCapitalize="words"
            style={styles.nameInput}
            returnKeyType="done"
          />
        </View>

        <OnboardingContinue onPress={onContinue} disabled={!isValid} />
      </SafeAreaView>
    </KeyboardDismiss>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.canvas, paddingHorizontal: Space.lg },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 40 },
  headline: {
    fontFamily: AmbitFont.display, fontSize: 30, color: Brand.inkPrimary,
    marginBottom: 32, alignSelf: 'flex-start',
  },
  avatarBtn: {
    width: 220, height: 220, borderRadius: 110,
    overflow: 'hidden',
    marginBottom: 32,
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarPlaceholder: {
    width: '100%', height: '100%',
    backgroundColor: Brand.seekerSurface,
    alignItems: 'center', justifyContent: 'center',
    gap: 10,
  },
  avatarLabel: {
    fontFamily: AmbitFont.body, fontSize: 13, color: Brand.accent,
  },
  nameInput: {
    width: '100%',
    height: 46, borderRadius: Radii.md,
    paddingHorizontal: 14,
    backgroundColor: Brand.surface1,
    borderWidth: 1.5, borderColor: Brand.borderDefault,
    fontFamily: AmbitFont.body, fontSize: 16, color: Brand.inkBody,
    fontWeight: '600',
    textAlign: 'center',
  },
});
