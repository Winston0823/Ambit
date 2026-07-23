import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Camera } from 'phosphor-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { Avatar, BackChevron, KeyboardDismiss } from '../../atoms';
import { AvatarPickerSheet, OnboardingContinue } from '../../molecules';
import { useOnboarding } from '../../../context/OnboardingContext';
import { Brand, AmbitFont, Radii, Space } from '../../../constants/theme';

interface Props { onBack: () => void; onContinue: () => void; }

/// S-011 Identity — monster mark + name (photo optional, revealed post-connect).
///   - 200px monster avatar centered, tap to pick a different mark
///   - "First + Last Name" text input below
///   - Optional photo row — only shown to others after they connect with you
///   - Anchored Continue at bottom
export function IdentityScreen({ onBack, onContinue }: Props) {
  const { profile, update } = useOnboarding();
  const [pickerVisible, setPickerVisible] = useState(false);

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

  const isValid = profile.name.trim().length > 1;

  return (
    <KeyboardDismiss>
      <SafeAreaView style={styles.root}>
        <BackChevron onPress={onBack} />

        <View style={styles.content}>
          <Text style={styles.headline}>Meet your mark</Text>

          <Pressable onPress={() => setPickerVisible(true)} style={styles.avatarBtn}>
            <Avatar avatarId={profile.avatarId} size={200} />
            <Text style={styles.avatarLabel}>Tap to pick a different monster</Text>
          </Pressable>

          <TextInput
            value={profile.name}
            onChangeText={(v) => update('name', v)}
            placeholder="First + Last Name"
            placeholderTextColor={Brand.inkPlaceholder}
            autoCapitalize="words"
            style={styles.nameInput}
            returnKeyType="done"
          />

          <Pressable onPress={openPicker} style={styles.photoRow}>
            {profile.photoUri ? (
              <Image
                source={{ uri: profile.photoUri }}
                style={styles.photoThumb}
                cachePolicy="memory-disk"
                transition={180}
              />
            ) : (
              <Camera size={20} color={Brand.actionDeep} weight="duotone" />
            )}
            <Text style={styles.photoText}>
              {profile.photoUri
                ? 'Photo added — shown after you connect'
                : 'Add a photo — only shown after someone connects with you'}
            </Text>
          </Pressable>
        </View>

        <OnboardingContinue onPress={onContinue} disabled={!isValid} />
      </SafeAreaView>

      <AvatarPickerSheet
        visible={pickerVisible}
        selectedId={profile.avatarId}
        onSelect={(id) => update('avatarId', id)}
        onClose={() => setPickerVisible(false)}
      />
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
    alignItems: 'center',
    gap: 10,
    marginBottom: 32,
  },
  avatarLabel: {
    fontFamily: AmbitFont.body, fontSize: 13, color: Brand.actionDeep,
  },
  nameInput: {
    width: '100%',
    height: 46, borderRadius: Radii.md,
    paddingHorizontal: 16,
    backgroundColor: Brand.surface1,
    borderWidth: 1.5, borderColor: Brand.borderDefault,
    fontFamily: AmbitFont.medium, fontSize: 16, color: Brand.inkBody,
    textAlign: 'center',
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: Radii.md,
    borderWidth: 1.5,
    borderColor: Brand.borderDefault,
    backgroundColor: Brand.surface1,
  },
  photoThumb: {
    width: 40, height: 40, borderRadius: Radii.sm,
  },
  photoText: {
    flex: 1,
    fontFamily: AmbitFont.body, fontSize: 13, color: Brand.inkMuted,
  },
});
