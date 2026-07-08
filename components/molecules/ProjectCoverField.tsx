import React from 'react';
import { Alert, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { ImageSquare, PencilSimple } from 'phosphor-react-native';
import { AmbitFont, Astra, Brand, Radii } from '../../constants/theme';

interface Props {
  /// Current cover — a remote public URL (saved project) or a local picker URI
  /// (just-picked, not yet uploaded). Null = empty state.
  uri: string | null;
  /// Fires with the picked local URI; the caller uploads it on save.
  onChange: (localUri: string) => void;
  label?: string;
}

/// Tappable cover-image field for the project create / edit flows. Owns the
/// expo-image-picker flow (portrait 4:5 crop to match the discovery card hero)
/// and hands back the local URI; the screen uploads to `project-images` on save.
export function ProjectCoverField({ uri, onChange, label = 'COVER IMAGE' }: Props) {
  const pick = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Photo access needed', 'Enable photo library access to add a cover image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [4, 5],
      quality: 0.85,
    });
    if (result.canceled) return;
    onChange(result.assets[0].uri);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Pressable onPress={pick} style={styles.frame} accessibilityLabel="Add or change project cover image">
        {uri ? (
          <>
            <Image source={{ uri }} style={styles.image} resizeMode="cover" />
            <View style={styles.editBadge}>
              <PencilSimple size={13} color={Brand.inkOnBrand} weight="bold" />
              <Text style={styles.editText}>Change</Text>
            </View>
          </>
        ) : (
          <View style={styles.empty}>
            <ImageSquare size={28} color={Astra.iris} weight="regular" />
            <Text style={styles.emptyText}>Add a cover image</Text>
            <Text style={styles.emptyHint}>Portrait works best</Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 36 },
  label: {
    fontFamily: AmbitFont.body,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
    color: Brand.inkLabel,
    marginBottom: 12,
  },
  frame: {
    height: 180,
    borderRadius: Radii.lg,
    backgroundColor: Brand.surface2,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Astra.hairlinePurple,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  empty: { alignItems: 'center', gap: 6 },
  emptyText: { fontFamily: AmbitFont.body, fontSize: 14.5, fontWeight: '600', color: Brand.inkBody },
  emptyHint: { fontFamily: AmbitFont.body, fontSize: 12.5, color: Brand.inkMuted },
  editBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radii.sm,
    backgroundColor: Brand.action,
  },
  editText: { fontFamily: AmbitFont.body, fontSize: 12, fontWeight: '700', color: Brand.inkOnBrand },
});
