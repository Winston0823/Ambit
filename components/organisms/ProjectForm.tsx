import React, { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapPin } from 'phosphor-react-native';
import { Button, Chip, KeyboardDismiss } from '../atoms';
import { CAMPUSES, ROLE_CATEGORIES, SKILL_CATEGORIES } from '../../data/mock';
import { AmbitFont, Brand, Radii, Space } from '../../constants/theme';

export interface ProjectFormValues {
  title: string;
  vibeBlurb: string;
  requiredSkills: string[];
  rolesSought: string[];
  campusId: string | null;
}

interface Props {
  initialValues?: Partial<ProjectFormValues>;
  submitLabel: string;
  onSubmit: (v: ProjectFormValues) => Promise<void>;
  /// Rendered between the campus picker and the submit button. Used by the
  /// edit screen for the active toggle and the delete button so we don't
  /// fork this form into two near-identical files.
  extraActions?: React.ReactNode;
}

const TITLE_MAX = 80;
const BLURB_MIN = 50;
const BLURB_MAX = 280;
const SKILLS_MIN = 1;
const SKILLS_MAX = 8;
const ROLES_MAX = 5;

/// Shared form used by project-new and project-edit. Validation lives here
/// because it's identical in both flows; the screens own data fetching,
/// the onSubmit network call, and any extra actions (toggle, delete).
export function ProjectForm({
  initialValues,
  submitLabel,
  onSubmit,
  extraActions,
}: Props) {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState(initialValues?.title ?? '');
  const [vibeBlurb, setVibeBlurb] = useState(initialValues?.vibeBlurb ?? '');
  const [requiredSkills, setRequiredSkills] = useState<string[]>(
    initialValues?.requiredSkills ?? [],
  );
  const [rolesSought, setRolesSought] = useState<string[]>(
    initialValues?.rolesSought ?? [],
  );
  const [campusId, setCampusId] = useState<string | null>(
    initialValues?.campusId ?? null,
  );
  const [submitting, setSubmitting] = useState(false);

  const titleValid = title.trim().length > 0;
  const blurbValid = vibeBlurb.length >= BLURB_MIN && vibeBlurb.length <= BLURB_MAX;
  const skillsValid =
    requiredSkills.length >= SKILLS_MIN && requiredSkills.length <= SKILLS_MAX;
  const isValid = titleValid && blurbValid && skillsValid;

  const toggleSkill = (tag: string) => {
    setRequiredSkills((prev) =>
      prev.includes(tag)
        ? prev.filter((t) => t !== tag)
        : prev.length < SKILLS_MAX
          ? [...prev, tag]
          : prev,
    );
  };

  const toggleRole = (role: string) => {
    setRolesSought((prev) =>
      prev.includes(role)
        ? prev.filter((r) => r !== role)
        : prev.length < ROLES_MAX
          ? [...prev, role]
          : prev,
    );
  };

  const submit = async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        vibeBlurb: vibeBlurb.trim(),
        requiredSkills,
        rolesSought,
        campusId,
      });
    } catch (e: any) {
      Alert.alert('Could not save', e?.message ?? 'Try again in a moment.');
    } finally {
      setSubmitting(false);
    }
  };

  const blurbShort = vibeBlurb.length > 0 && vibeBlurb.length < BLURB_MIN;

  return (
    <KeyboardDismiss>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 180 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Section eyebrow="TITLE">
          <TextInput
            value={title}
            onChangeText={(v) => setTitle(v.slice(0, TITLE_MAX))}
            placeholder="A short, memorable name"
            placeholderTextColor={Brand.inkPlaceholder}
            style={styles.input}
          />
        </Section>

        <Section eyebrow="THE PITCH">
          <TextInput
            value={vibeBlurb}
            onChangeText={(v) => setVibeBlurb(v.slice(0, BLURB_MAX))}
            placeholder="Why does this exist? What problem are you solving? What kind of team are you building?"
            placeholderTextColor={Brand.inkPlaceholder}
            multiline
            style={styles.textarea}
          />
          <View style={styles.counterRow}>
            {blurbShort ? (
              <Text style={styles.counterHelp}>
                Need {BLURB_MIN - vibeBlurb.length} more characters.
              </Text>
            ) : (
              <View style={{ flex: 1 }} />
            )}
            <Text style={styles.counter}>
              {vibeBlurb.length} / {BLURB_MAX}
            </Text>
          </View>
        </Section>

        <Section eyebrow={`SKILLS YOU NEED  ·  ${requiredSkills.length} / ${SKILLS_MAX}`}>
          {SKILL_CATEGORIES.map((cat) => (
            <View key={cat.label} style={styles.category}>
              <Text style={styles.categoryLabel}>{cat.label}</Text>
              <View style={styles.chipRow}>
                {cat.tags.map((tag) => (
                  <Chip
                    key={tag}
                    label={tag}
                    selected={requiredSkills.includes(tag)}
                    onPress={() => toggleSkill(tag)}
                  />
                ))}
              </View>
            </View>
          ))}
        </Section>

        <Section
          eyebrow={`ROLES YOU'RE HIRING  ·  ${rolesSought.length} / ${ROLES_MAX}  ·  OPTIONAL`}
        >
          {ROLE_CATEGORIES.map((cat) => (
            <View key={cat.label} style={styles.category}>
              <Text style={styles.categoryLabel}>{cat.label}</Text>
              <View style={styles.chipRow}>
                {cat.roles.map((role) => (
                  <Chip
                    key={role}
                    label={role}
                    selected={rolesSought.includes(role)}
                    onPress={() => toggleRole(role)}
                  />
                ))}
              </View>
            </View>
          ))}
        </Section>

        <Section eyebrow="CAMPUS  ·  OPTIONAL">
          <View style={{ gap: 8 }}>
            {CAMPUSES.map((c) => {
              const selected = campusId === c.id;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => setCampusId(selected ? null : c.id)}
                  style={[styles.campusRow, selected && styles.campusRowSelected]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <MapPin
                    size={18}
                    color={selected ? Brand.seekerInk : Brand.inkMuted}
                    weight={selected ? 'fill' : 'regular'}
                  />
                  <Text
                    style={[styles.campusName, selected && styles.campusNameSelected]}
                  >
                    {c.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Section>

        {extraActions}

        <View style={{ marginTop: Space.lg }}>
          <Button
            title={submitting ? 'Saving…' : submitLabel}
            onPress={submit}
            disabled={!isValid || submitting}
          />
        </View>
      </ScrollView>
    </KeyboardDismiss>
  );
}

function Section({
  eyebrow,
  children,
}: {
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: Space.lg,
    paddingTop: Space.md,
    gap: Space.xl,
  },
  section: { gap: 10 },
  eyebrow: {
    fontFamily: AmbitFont.body,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
    color: Brand.inkLabel,
  },
  input: {
    height: 46,
    borderRadius: Radii.md,
    paddingHorizontal: 14,
    backgroundColor: Brand.surface1,
    borderWidth: 1.5,
    borderColor: Brand.borderDefault,
    fontFamily: AmbitFont.body,
    fontSize: 15,
    color: Brand.inkBody,
  },
  textarea: {
    minHeight: 130,
    borderRadius: Radii.lg,
    paddingTop: 14,
    paddingHorizontal: 14,
    paddingBottom: 14,
    backgroundColor: Brand.surface1,
    borderWidth: 1.5,
    borderColor: Brand.borderDefault,
    fontFamily: AmbitFont.body,
    fontSize: 15,
    color: Brand.inkBody,
    textAlign: 'left',
    textAlignVertical: 'top',
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  counterHelp: {
    flex: 1,
    fontFamily: AmbitFont.body,
    fontSize: 13,
    color: Brand.accent,
  },
  counter: {
    fontFamily: AmbitFont.body,
    fontSize: 12,
    color: Brand.inkMuted,
  },
  category: { marginTop: 8, gap: 10 },
  categoryLabel: {
    fontFamily: AmbitFont.body,
    fontSize: 11,
    letterSpacing: 1.2,
    color: Brand.inkLabel,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  campusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: Brand.surface2,
    borderRadius: Radii.md,
  },
  campusRowSelected: { backgroundColor: Brand.seekerSurface },
  campusName: {
    fontFamily: AmbitFont.body,
    fontSize: 14,
    color: Brand.inkBody,
  },
  campusNameSelected: {
    color: Brand.seekerInk,
    fontWeight: '600',
  },
});
