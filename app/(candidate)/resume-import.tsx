import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Crypto from 'expo-crypto';
import { Check, FileArrowUp, Camera, ClipboardText } from 'phosphor-react-native';
import { BackChevron, HardShadow } from '../../components/atoms';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { upsertPortfolioItem } from '../../lib/portfolio';
import {
  parseResumeText,
  pickAndParseDocument,
  pickAndParsePhoto,
  normalizeResumeSkills,
  type ParsedResume,
} from '../../lib/resume';
import { AmbitFont, Brand, Radii, Space } from '../../constants/theme';

const MAX_SKILLS = 8;
const clampTitle = (s: string) => s.trim().slice(0, 60);
const clampDesc = (s: string) => s.trim().slice(0, 400);

/// S-105 Résumé import — review & apply. Two phases in one screen:
///   1. Source: paste text / upload a file / use a photo → parse.
///   2. Review: edit the extracted fields, multi-select which experiences and
///      projects to keep as portfolio highlights, then write to the profile.
/// Nothing is applied without the user confirming on the review screen.
export default function ResumeImportScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [parsing, setParsing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [parsed, setParsed] = useState<ParsedResume | null>(null);

  // The user's CURRENT profile — import is additive, so we merge against this
  // and never overwrite a name/blurb they've already written or drop existing
  // skills.
  const [existing, setExisting] = useState<{ name: string; blurb: string; skills: string[] }>({
    name: '', blurb: '', skills: [],
  });
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('name, vibe_blurb, skills')
        .eq('id', user.id)
        .maybeSingle();
      if (cancelled || !data) return;
      const d = data as { name: string | null; vibe_blurb: string | null; skills: string[] | null };
      setExisting({ name: d.name ?? '', blurb: d.vibe_blurb ?? '', skills: d.skills ?? [] });
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  // Editable review state (seeded from the parse).
  const [name, setName] = useState('');
  const [blurb, setBlurb] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [skillsOn, setSkillsOn] = useState<Set<string>>(new Set());
  const [expOn, setExpOn] = useState<Set<number>>(new Set());
  const [projOn, setProjOn] = useState<Set<number>>(new Set());

  const seedReview = (r: ParsedResume) => {
    setParsed(r);
    // Non-destructive: keep an existing name/blurb the user already wrote;
    // only use the imported one to fill a blank. (Still editable below.)
    setName(existing.name.trim() ? existing.name : (r.name ?? ''));
    setBlurb(existing.blurb.trim() ? existing.blurb : (r.headline ?? ''));
    // Skills MERGE — existing first (so they're never dropped), then imported.
    const merged = normalizeResumeSkills([...existing.skills, ...(r.skills ?? [])]);
    setSkills(merged);
    setSkillsOn(new Set(merged.slice(0, MAX_SKILLS))); // existing kept; imported fills up to the cap
    setExpOn(new Set()); // experiences are opt-in (user's call)
    setProjOn(new Set((r.portfolio ?? []).map((_, i) => i))); // projects default on
  };

  const runParse = async (fn: () => Promise<ParsedResume | null>) => {
    if (parsing) return;
    setParsing(true);
    try {
      const r = await fn();
      if (r) seedReview(r);
    } catch (e: any) {
      Alert.alert("Couldn't read that résumé", e?.message ?? 'Try another source.');
    } finally {
      setParsing(false);
    }
  };

  const toggleSkill = (s: string) => {
    setSkillsOn((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else if (next.size < MAX_SKILLS) next.add(s);
      return next;
    });
  };
  const toggleSet = (setter: React.Dispatch<React.SetStateAction<Set<number>>>, i: number) => {
    setter((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const selectedSkills = useMemo(() => skills.filter((s) => skillsOn.has(s)), [skills, skillsOn]);

  const apply = async () => {
    if (!user || !parsed || applying) return;
    setApplying(true);
    try {
      // 1. Profile fields — only overwrite what we actually have.
      const patch: Record<string, unknown> = {};
      if (name.trim()) patch.name = name.trim();
      if (blurb.trim()) patch.vibe_blurb = blurb.trim().slice(0, 140);
      if (selectedSkills.length) patch.skills = selectedSkills;
      if (Object.keys(patch).length) {
        const { error } = await supabase.from('profiles').update(patch).eq('id', user.id);
        if (error) throw error;
        // Keep the vibe embedding fresh for matching if the text changed.
        if (patch.name || patch.vibe_blurb) {
          supabase.functions
            .invoke('embed-vibe', {
              body: { table: 'profiles', id: user.id, text: `${name.trim()}\n\n${blurb.trim()}` },
            })
            .catch(() => {});
        }
      }

      // 2. Selected experiences + projects → portfolio highlights (no images).
      const highlights: { title: string; description: string; linkUrl: string | null }[] = [];
      parsed.experience.forEach((e, i) => {
        if (!expOn.has(i)) return;
        const title = clampTitle(e.org ? `${e.title} @ ${e.org}` : e.title);
        const description = clampDesc(e.summary || e.title);
        if (title && description) highlights.push({ title, description, linkUrl: null });
      });
      parsed.portfolio.forEach((p, i) => {
        if (!projOn.has(i)) return;
        const title = clampTitle(p.title);
        const description = clampDesc(p.description || p.title);
        if (title && description) highlights.push({ title, description, linkUrl: p.link || null });
      });

      for (const h of highlights) {
        try {
          await upsertPortfolioItem({
            userId: user.id,
            id: Crypto.randomUUID(),
            title: h.title,
            description: h.description,
            linkUrl: h.linkUrl,
          });
        } catch (e) {
          console.warn('portfolio item from résumé failed:', e);
        }
      }

      router.back();
    } catch (e: any) {
      Alert.alert("Couldn't apply", e?.message ?? 'Try again.');
      setApplying(false);
    }
  };

  // ── Source phase ──────────────────────────────────────────────────
  if (!parsed) {
    return (
      <View style={styles.root}>
        <View style={{ marginTop: insets.top + 6 }}>
          <BackChevron onPress={() => router.back()} />
        </View>
        <ScrollView contentContainerStyle={styles.sourceContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.kicker}>IMPORT RÉSUMÉ</Text>
          <Text style={styles.h}>Let's fill this{'\n'}in for you</Text>
          <Text style={styles.sub}>Paste it, upload a file, or snap a photo — we'll pull out your skills, blurb, and projects. You review everything before anything saves.</Text>

          <Text style={styles.fieldLabel}>PASTE FROM A DOC</Text>
          <TextInput
            value={pasteText}
            onChangeText={setPasteText}
            placeholder="Paste your résumé text here…"
            placeholderTextColor={Brand.inkPlaceholder}
            style={styles.pasteBox}
            multiline
            textAlignVertical="top"
          />
          <Pressable
            onPress={() => runParse(() => parseResumeText(pasteText.trim()))}
            disabled={pasteText.trim().length < 20 || parsing}
            style={[styles.parseBtn, (pasteText.trim().length < 20 || parsing) && styles.disabled]}
          >
            <ClipboardText size={18} color={Brand.actionInk} weight="bold" />
            <Text style={styles.parseBtnText}>Parse pasted text</Text>
          </Pressable>

          <View style={styles.orRow}>
            <View style={styles.orLine} /><Text style={styles.orText}>OR</Text><View style={styles.orLine} />
          </View>

          <Pressable onPress={() => runParse(() => pickAndParseDocument(user!.id))} disabled={parsing} style={[styles.sourceBtn, parsing && styles.disabled]}>
            <FileArrowUp size={20} color={Brand.inkPrimary} weight="regular" />
            <Text style={styles.sourceBtnText}>Upload a file (PDF or Word)</Text>
          </Pressable>
          <Pressable onPress={() => runParse(() => pickAndParsePhoto(user!.id))} disabled={parsing} style={[styles.sourceBtn, parsing && styles.disabled]}>
            <Camera size={20} color={Brand.inkPrimary} weight="regular" />
            <Text style={styles.sourceBtnText}>Use a photo of your résumé</Text>
          </Pressable>

          <View style={{ height: 80 }} />
        </ScrollView>

        {parsing && (
          <View style={styles.overlay} pointerEvents="auto">
            <ActivityIndicator color={Brand.accent} />
            <Text style={styles.overlayText}>Reading your résumé…</Text>
          </View>
        )}
      </View>
    );
  }

  // ── Review phase ──────────────────────────────────────────────────
  const linksFound = [parsed.links.github, parsed.links.linkedin, parsed.links.portfolio].filter(Boolean);

  return (
    <View style={styles.root}>
      <View style={{ marginTop: insets.top + 6 }}>
        <BackChevron onPress={() => setParsed(null)} />
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.reviewContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.kicker}>REVIEW · EDIT ANYTHING</Text>
          <Text style={styles.h}>Here's what{'\n'}we found</Text>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>NAME</Text>
            <TextInput value={name} onChangeText={setName} style={styles.input} placeholderTextColor={Brand.inkPlaceholder} />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>HEADLINE</Text>
            <TextInput value={blurb} onChangeText={setBlurb} style={[styles.input, styles.inputMultiline]} multiline maxLength={140} placeholderTextColor={Brand.inkPlaceholder} />
          </View>

          {skills.length > 0 && (
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>SKILLS · TAP TO KEEP ({skillsOn.size}/{MAX_SKILLS})</Text>
              <View style={styles.chips}>
                {skills.map((s) => {
                  const on = skillsOn.has(s);
                  return (
                    <Pressable key={s} onPress={() => toggleSkill(s)} style={[styles.chip, on && styles.chipOn]}>
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>{s}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {parsed.experience.length > 0 && (
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>EXPERIENCE · PICK ANY TO SHOWCASE</Text>
              <Text style={styles.fieldHint}>Add roles, ventures, or projects from your experience as portfolio highlights.</Text>
              {parsed.experience.map((e, i) => (
                <SelectRow
                  key={i}
                  selected={expOn.has(i)}
                  onPress={() => toggleSet(setExpOn, i)}
                  title={e.org ? `${e.title} · ${e.org}` : e.title}
                  sub={e.summary}
                />
              ))}
            </View>
          )}

          {parsed.portfolio.length > 0 && (
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>PROJECTS · PICK ANY TO SHOWCASE</Text>
              {parsed.portfolio.map((p, i) => (
                <SelectRow
                  key={i}
                  selected={projOn.has(i)}
                  onPress={() => toggleSet(setProjOn, i)}
                  title={p.title}
                  sub={p.description}
                />
              ))}
            </View>
          )}

          {linksFound.length > 0 && (
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>LINKS WE SPOTTED</Text>
              {linksFound.map((l) => <Text key={l} style={styles.linkText} numberOfLines={1}>{l}</Text>)}
              <Text style={styles.fieldHint}>Saved to your profile once links land — captured for now.</Text>
            </View>
          )}

          <View style={{ height: 120 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      <HardShadow radius={999} offset={4} style={[styles.ctaWrap, { bottom: insets.bottom + 24 }, applying && styles.disabled]}>
        <Pressable onPress={apply} disabled={applying} style={styles.cta}>
          {applying ? <ActivityIndicator color={Brand.actionInk} /> : <Text style={styles.ctaText}>Add to my profile</Text>}
        </Pressable>
      </HardShadow>
    </View>
  );
}

/// One selectable highlight row — a check pill toggles inclusion.
function SelectRow({ selected, onPress, title, sub }: { selected: boolean; onPress: () => void; title: string; sub?: string }) {
  return (
    <Pressable onPress={onPress} style={[styles.selRow, selected && styles.selRowOn]}>
      <View style={[styles.checkbox, selected && styles.checkboxOn]}>
        {selected && <Check size={13} color={Brand.inkOnBrand} weight="bold" />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.selTitle} numberOfLines={1}>{title || 'Untitled'}</Text>
        {!!sub && <Text style={styles.selSub} numberOfLines={2}>{sub}</Text>}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.cardCream },
  sourceContent: { paddingHorizontal: 28, paddingTop: 16 },
  reviewContent: { paddingHorizontal: 28, paddingTop: 16 },

  kicker: { fontFamily: AmbitFont.body, fontSize: 11, fontWeight: '700', letterSpacing: 1.6, color: Brand.inkMuted, marginBottom: 12 },
  h: { fontFamily: AmbitFont.display, fontSize: 34, lineHeight: 40, color: Brand.inkPrimary },
  sub: { fontFamily: AmbitFont.body, fontSize: 14.5, color: Brand.inkMuted, marginTop: 16, lineHeight: 21 },

  field: { marginTop: 32 },
  fieldLabel: { fontFamily: AmbitFont.body, fontSize: 11, fontWeight: '600', letterSpacing: 1.2, color: Brand.inkLabel, marginBottom: 12, marginTop: 24 },
  fieldHint: { fontFamily: AmbitFont.body, fontSize: 13, color: Brand.inkMuted, marginTop: -4, marginBottom: 14, lineHeight: 19 },
  input: { fontFamily: AmbitFont.display, fontSize: 22, color: Brand.inkPrimary, borderBottomWidth: 1.5, borderBottomColor: Brand.borderDefault, paddingBottom: 12 },
  inputMultiline: { fontSize: 18, lineHeight: 25, minHeight: 56, textAlignVertical: 'top' },

  pasteBox: {
    fontFamily: AmbitFont.body, fontSize: 15, lineHeight: 22, color: Brand.inkPrimary,
    backgroundColor: Brand.surface1, borderRadius: Radii.lg, borderWidth: 1.5, borderColor: Brand.borderDefault,
    padding: 16, minHeight: 140,
  },
  parseBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 14, paddingVertical: 14, borderRadius: 999,
    backgroundColor: Brand.action, borderWidth: 1.6, borderColor: Brand.actionInk,
  },
  parseBtnText: { fontFamily: AmbitFont.body, fontSize: 15, fontWeight: '700', color: Brand.actionInk },

  orRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 24 },
  orLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: Brand.borderDefault },
  orText: { fontFamily: AmbitFont.body, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, color: Brand.inkMuted },

  sourceBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 16, paddingHorizontal: 18, marginBottom: 12,
    borderRadius: Radii.lg, backgroundColor: Brand.surface1, borderWidth: 1.5, borderColor: Brand.inkEdge,
  },
  sourceBtnText: { fontFamily: AmbitFont.body, fontSize: 15, fontWeight: '600', color: Brand.inkPrimary },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, backgroundColor: Brand.cardCream, borderWidth: 1.5, borderColor: Brand.borderDefault },
  chipOn: { backgroundColor: Brand.action, borderColor: Brand.actionInk },
  chipText: { fontFamily: AmbitFont.body, fontSize: 14, fontWeight: '600', color: Brand.inkMuted },
  chipTextOn: { color: Brand.actionInk, fontWeight: '700' },

  selRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    paddingVertical: 14, paddingHorizontal: 16, marginBottom: 10,
    borderRadius: Radii.lg, backgroundColor: Brand.cardCream, borderWidth: 1.5, borderColor: Brand.borderDefault,
  },
  selRowOn: { borderColor: Brand.actionInk, backgroundColor: Brand.surface1 },
  checkbox: {
    width: 22, height: 22, borderRadius: 7, marginTop: 1,
    borderWidth: 1.5, borderColor: Brand.borderDefault,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: Brand.action, borderColor: Brand.actionInk },
  selTitle: { fontFamily: AmbitFont.body, fontSize: 15, fontWeight: '700', color: Brand.inkPrimary },
  selSub: { fontFamily: AmbitFont.body, fontSize: 13, color: Brand.inkMuted, marginTop: 3, lineHeight: 18 },

  linkText: { fontFamily: AmbitFont.body, fontSize: 14, color: Brand.actionDeep, marginBottom: 4 },

  disabled: { opacity: 0.4 },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(245,242,234,0.82)',
    alignItems: 'center', justifyContent: 'center', gap: 12,
  },
  overlayText: { fontFamily: AmbitFont.body, fontSize: 14, fontWeight: '600', color: Brand.inkBody },

  ctaWrap: { position: 'absolute', alignSelf: 'center' },
  cta: {
    backgroundColor: Brand.action, borderWidth: 1.6, borderColor: Brand.actionInk,
    paddingHorizontal: 48, paddingVertical: 16, borderRadius: 999, minWidth: 220, alignItems: 'center',
  },
  ctaText: { fontFamily: AmbitFont.body, fontSize: 16, fontWeight: '700', color: Brand.actionInk },
});
