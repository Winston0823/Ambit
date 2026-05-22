import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PencilSimpleLine, Trash, X } from 'phosphor-react-native';
import * as Haptics from 'expo-haptics';
import {
  AmbitFont,
  Brand,
  Radii,
  Space,
  TypeScale,
} from '../../constants/theme';
import type { PortfolioItem } from '../../data/mock';

type Mode = 'view' | 'edit';

interface Props {
  /// The portfolio item to display, or null when no modal should render.
  item: PortfolioItem | null;
  /// Dismiss request — fires when the user taps the scrim or the bubble
  /// again. Parent clears the item to actually close the modal.
  onDismiss: () => void;
  /// When provided, the modal exposes an edit pencil and a delete button.
  /// Profile mode only — discovery passes neither.
  onSave?: (updated: PortfolioItem) => void;
  onDelete?: (id: string) => void;
}

/// Tap-to-expand portfolio detail. Two modes:
///   - 'view'  → image + bold title + 2–4 sentence body. The only chrome is
///               the small pencil in the corner (when onSave is wired) and
///               the implicit "tap outside to dismiss" scrim.
///   - 'edit'  → title and description become inputs; Delete + Save in the
///               footer. Reached by tapping the pencil from view mode.
export function PortfolioModal({ item, onDismiss, onSave, onDelete }: Props) {
  const [mode, setMode] = useState<Mode>('view');
  const [draftTitle, setDraftTitle] = useState('');
  const [draftDescription, setDraftDescription] = useState('');

  // Fade + scale entry animation. Modal mounts with visible=true on the next
  // tick so the animation always plays from 0 (no instant pop on rapid taps).
  const scrimOpacity = useRef(new Animated.Value(0)).current;
  const sheetScale  = useRef(new Animated.Value(0.94)).current;
  const sheetOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (item) {
      // Reset mode and drafts whenever a fresh item is opened.
      setMode('view');
      setDraftTitle(item.title);
      setDraftDescription(item.description);
      Animated.parallel([
        Animated.timing(scrimOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(sheetScale, { toValue: 1, friction: 8, tension: 110, useNativeDriver: true }),
        Animated.timing(sheetOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    } else {
      // Reset for next open
      scrimOpacity.setValue(0);
      sheetScale.setValue(0.94);
      sheetOpacity.setValue(0);
    }
  }, [item, scrimOpacity, sheetScale, sheetOpacity]);

  if (!item) return null;

  const isEditable = !!onSave;
  const canSave = mode === 'edit' && draftTitle.trim().length > 0;

  const handleScrimPress = () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    onDismiss();
  };

  const handleEdit = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    setMode('edit');
  };

  const handleSave = () => {
    if (!canSave || !onSave) return;
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    onSave({
      ...item,
      title: draftTitle.trim(),
      description: draftDescription.trim(),
    });
  };

  const handleDelete = () => {
    if (!onDelete) return;
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    }
    onDelete(item.id);
  };

  return (
    <Modal
      transparent
      animationType="none"
      visible={!!item}
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.root}
      >
        {/* Scrim — captures taps for dismissal. */}
        <Animated.View style={[styles.scrimWrap, { opacity: scrimOpacity }]}>
          <Pressable style={styles.scrim} onPress={handleScrimPress} />
        </Animated.View>

        {/* Sheet — animated scale + opacity entry. */}
        <Animated.View
          style={[
            styles.sheet,
            { opacity: sheetOpacity, transform: [{ scale: sheetScale }] },
          ]}
        >
          {/* Image hero */}
          <View style={styles.imgWrap}>
            {item.imageUri ? (
              <Image source={{ uri: item.imageUri }} style={styles.img} />
            ) : (
              <LinearGradient
                colors={item.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.img}
              >
                <Text style={styles.imgInitial}>
                  {(item.title[0] ?? '').toUpperCase()}
                </Text>
              </LinearGradient>
            )}

            {/* Mode toggle controls float over the image */}
            {isEditable && mode === 'view' && (
              <Pressable onPress={handleEdit} style={styles.cornerBtn} hitSlop={10}>
                <PencilSimpleLine size={16} color={Brand.inkPrimary} weight="regular" />
              </Pressable>
            )}
            {mode === 'edit' && (
              <Pressable onPress={() => setMode('view')} style={styles.cornerBtn} hitSlop={10}>
                <X size={18} color={Brand.inkPrimary} weight="bold" />
              </Pressable>
            )}
          </View>

          {/* Body */}
          <View style={styles.body}>
            {mode === 'view' ? (
              <>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.description}>{item.description}</Text>
              </>
            ) : (
              <>
                <Text style={styles.fieldLabel}>TITLE</Text>
                <TextInput
                  value={draftTitle}
                  onChangeText={setDraftTitle}
                  placeholder="Project title"
                  placeholderTextColor={Brand.inkPlaceholder}
                  style={styles.titleInput}
                  maxLength={60}
                />
                <Text style={[styles.fieldLabel, { marginTop: 8 }]}>DESCRIPTION</Text>
                <TextInput
                  value={draftDescription}
                  onChangeText={setDraftDescription}
                  placeholder="What is this project and why does it matter?"
                  placeholderTextColor={Brand.inkPlaceholder}
                  multiline
                  style={styles.descriptionInput}
                  maxLength={400}
                />

                <View style={styles.editFooter}>
                  {onDelete && (
                    <Pressable onPress={handleDelete} style={styles.deleteBtn} hitSlop={6}>
                      <Trash size={16} color="#C0392B" weight="regular" />
                      <Text style={styles.deleteLabel}>Delete</Text>
                    </Pressable>
                  )}
                  <View style={{ flex: 1 }} />
                  <Pressable
                    onPress={handleSave}
                    disabled={!canSave}
                    style={[styles.saveBtn, !canSave && { opacity: 0.45 }]}
                  >
                    <Text style={styles.saveLabel}>Save</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Space.lg,
  },
  scrimWrap: {
    ...StyleSheet.absoluteFillObject,
  },
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },

  sheet: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: Brand.canvas,
    borderRadius: Radii.lg + 4,
    overflow: 'hidden',
    // iOS shadow
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 32,
    // Android elevation
    elevation: 12,
  },

  imgWrap: {
    width: '100%',
    height: 260,
    position: 'relative',
  },
  img: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imgInitial: {
    fontFamily: AmbitFont.display,
    fontSize: 100,
    color: 'rgba(255, 255, 255, 0.88)',
  },
  cornerBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: Radii.full,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  body: {
    padding: Space.lg,
    gap: 12,
  },
  title: {
    fontFamily: AmbitFont.display,
    fontSize: 26,
    color: Brand.inkPrimary,
    lineHeight: 32,
  },
  description: {
    ...TypeScale.body,
    fontSize: 15,
    color: Brand.inkBody,
    lineHeight: 22,
  },

  // ── Edit mode ───────────────────────────────────────────────────────────
  fieldLabel: {
    ...TypeScale.labelSm,
    color: Brand.inkLabel,
  },
  titleInput: {
    fontFamily: AmbitFont.display,
    fontSize: 22,
    color: Brand.inkPrimary,
    paddingHorizontal: 0,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Brand.borderDefault,
  },
  descriptionInput: {
    fontFamily: AmbitFont.body,
    fontSize: 15,
    color: Brand.inkBody,
    lineHeight: 22,
    minHeight: 88,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: Brand.surface1,
    borderRadius: Radii.md,
    textAlignVertical: 'top',
  },
  editFooter: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  deleteLabel: {
    fontFamily: AmbitFont.body,
    fontSize: 14,
    fontWeight: '600',
    color: '#C0392B',
  },
  saveBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: Brand.primary,
    borderRadius: Radii.md,
  },
  saveLabel: {
    fontFamily: AmbitFont.body,
    fontSize: 14,
    fontWeight: '600',
    color: Brand.inkOnBrand,
  },
});
