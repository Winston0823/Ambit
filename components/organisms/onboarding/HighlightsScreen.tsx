import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { randomUUID } from 'expo-crypto';
import { ImageSquare, Plus, Stack, X } from 'phosphor-react-native';
import { BackChevron, HardShadow } from '../../atoms';
import { OnboardingContinue } from '../../molecules';
import { useOnboarding } from '../../../context/OnboardingContext';
import { toast } from '../../../lib/toast';
import { Brand, AmbitFont, Radii, Space } from '../../../constants/theme';

interface Props { onBack: () => void; onContinue: () => void; }

const MAX_HIGHLIGHTS = 3;

/// Highlights — skippable. Users add up to 3 past-work highlights (title +
/// one-line description + optional cover) straight into the in-memory
/// onboarding profile. Upload to storage / portfolio_items happens at submit
/// time (see OnboardingContext.submit). Continue is always enabled; the label
/// flips to "Skip for now" when nothing has been added.
export function HighlightsScreen({ onBack, onContinue }: Props) {
  const { profile, update } = useOnboarding();
  const insets = useSafeAreaInsets();

  const highlights = profile.highlights;
  const atMax = highlights.length >= MAX_HIGHLIGHTS;

  // Inline composer draft (not persisted until "Add highlight").
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);

  const remove = (id: string) => {
    update('highlights', highlights.filter((h) => h.id !== id));
  };

  const pickCover = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      toast.error('Enable photo access in Settings to add a cover.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.85,
    });
    if (result.canceled) return;
    setImageUri(result.assets[0].uri);
  };

  const addHighlight = () => {
    if (!title.trim() || atMax) return;
    update('highlights', [
      ...highlights,
      { id: randomUUID(), title: title.trim(), description: description.trim(), imageUri },
    ]);
    setTitle('');
    setDescription('');
    setImageUri(null);
  };

  const canAdd = title.trim().length > 0 && !atMax;

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.watermark} pointerEvents="none">
        <Stack size={360} color={Brand.actionDeep} weight="duotone" />
      </View>

      <BackChevron onPress={onBack} />

      <View style={styles.header}>
        <Text style={styles.kicker}>Highlights</Text>
        <Text style={styles.headline}>Show what you've built</Text>
        <Text style={styles.subtitle}>
          Add past projects to your profile — this is what people see first.
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 130 }]}
        keyboardShouldPersistTaps="handled"
      >
        {highlights.map((h) => (
          <HardShadow key={h.id} radius={Radii.md} offset={4} style={styles.rowShadow}>
            <View style={styles.row}>
              {h.imageUri ? (
                <Image source={{ uri: h.imageUri }} style={styles.thumb} contentFit="cover" />
              ) : (
                <View style={[styles.thumb, styles.thumbEmpty]}>
                  <ImageSquare size={20} color={Brand.inkPlaceholder} weight="regular" />
                </View>
              )}
              <View style={styles.rowText}>
                <Text style={styles.rowTitle} numberOfLines={1}>{h.title}</Text>
                {h.description.length > 0 && (
                  <Text style={styles.rowDesc} numberOfLines={1}>{h.description}</Text>
                )}
              </View>
              <Pressable
                onPress={() => remove(h.id)}
                hitSlop={8}
                style={styles.removeBtn}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${h.title}`}
              >
                <X size={16} color={Brand.inkLabel} weight="bold" />
              </Pressable>
            </View>
          </HardShadow>
        ))}

        {!atMax && (
          <View style={styles.composer}>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Project title"
              placeholderTextColor={Brand.inkPlaceholder}
              style={styles.input}
              maxLength={60}
              returnKeyType="next"
            />
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="One line on what it was"
              placeholderTextColor={Brand.inkPlaceholder}
              style={styles.input}
              maxLength={120}
              returnKeyType="done"
              onSubmitEditing={addHighlight}
            />

            <View style={styles.composerActions}>
              <Pressable
                onPress={pickCover}
                style={styles.coverChip}
                accessibilityRole="button"
                accessibilityLabel="Add cover image"
              >
                {imageUri ? (
                  <Image source={{ uri: imageUri }} style={styles.coverChipThumb} contentFit="cover" />
                ) : (
                  <ImageSquare size={16} color={Brand.actionDeep} weight="regular" />
                )}
                <Text style={styles.coverChipText}>{imageUri ? 'Cover added' : 'Add cover'}</Text>
              </Pressable>

              <Pressable
                onPress={addHighlight}
                disabled={!canAdd}
                style={[styles.addBtn, !canAdd && styles.addBtnDisabled]}
                accessibilityRole="button"
                accessibilityLabel="Add highlight"
              >
                <Plus size={15} color={Brand.inkOnBrand} weight="bold" />
                <Text style={styles.addBtnText}>Add highlight</Text>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>

      <OnboardingContinue
        onPress={onContinue}
        title={highlights.length > 0 ? 'Continue' : 'Skip for now'}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.canvas },
  watermark: {
    position: 'absolute',
    top: 110,
    right: -90,
    opacity: 0.08,
  },
  header: {
    paddingHorizontal: Space.lg,
    marginTop: 40,
    marginBottom: Space.md,
  },
  kicker: {
    fontFamily: AmbitFont.semibold,
    fontSize: 12,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: Brand.inkLabel,
    marginBottom: 12,
  },
  headline: {
    fontFamily: AmbitFont.display,
    fontSize: 34,
    color: Brand.inkPrimary,
    lineHeight: 40,
  },
  subtitle: {
    fontFamily: AmbitFont.body,
    fontSize: 13,
    color: Brand.inkMuted,
    marginTop: 12,
  },
  scroll: {
    paddingHorizontal: Space.lg,
    paddingTop: Space.sm,
  },
  rowShadow: { marginBottom: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: Brand.cardCream,
    borderRadius: Radii.md,
    borderWidth: 1.5,
    borderColor: 'rgba(111,77,162,0.28)',
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: Radii.sm,
    backgroundColor: Brand.surface2,
  },
  thumbEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1 },
  rowTitle: {
    fontFamily: AmbitFont.semibold,
    fontSize: 15,
    color: Brand.inkHigh,
  },
  rowDesc: {
    fontFamily: AmbitFont.body,
    fontSize: 12,
    color: Brand.inkMuted,
    marginTop: 2,
  },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: Radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brand.surface2,
  },
  composer: {
    gap: 10,
    marginTop: Space.xs,
    padding: 14,
    backgroundColor: Brand.cardCream,
    borderRadius: Radii.md,
    borderWidth: 1.5,
    borderColor: Brand.borderDefault,
  },
  input: {
    height: 44,
    borderRadius: Radii.sm,
    paddingHorizontal: 14,
    backgroundColor: Brand.surface1,
    borderWidth: 1.5,
    borderColor: Brand.borderDefault,
    fontFamily: AmbitFont.body,
    fontSize: 14,
    color: Brand.inkBody,
  },
  composerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: Space.xs,
  },
  coverChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radii.pill,
    backgroundColor: Brand.seekerSurface,
  },
  coverChipThumb: {
    width: 18,
    height: 18,
    borderRadius: Radii.sm,
  },
  coverChipText: {
    fontFamily: AmbitFont.semibold,
    fontSize: 13,
    color: Brand.actionDeep,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Radii.pill,
    backgroundColor: Brand.action,
  },
  addBtnDisabled: { opacity: 0.4 },
  addBtnText: {
    fontFamily: AmbitFont.bold,
    fontSize: 13.5,
    color: Brand.inkOnBrand,
  },
});
