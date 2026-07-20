import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Camera, ClipboardText, FileArrowUp } from 'phosphor-react-native';
import { BottomSheet } from './BottomSheet';
import {
  parseResumeText,
  pickAndParseDocument,
  pickAndParsePhoto,
  type ParsedResume,
} from '../../lib/resume';
import { AmbitFont, Brand, Radii } from '../../constants/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  userId: string;
  /// Fires with the parsed résumé; the caller decides how to apply it.
  onParsed: (r: ParsedResume) => void;
}

/// Reusable résumé-import source picker — paste text, upload a PDF/Word file,
/// or use a photo. Hands the parsed result back via onParsed. Used in
/// onboarding (fills the draft) and could back the editor flow too.
export function ResumeImportSheet({ visible, onClose, userId, onParsed }: Props) {
  const [pasteText, setPasteText] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<ParsedResume | null>) => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await fn();
      if (r) {
        onParsed(r);
        setPasteText('');
        onClose();
      }
    } catch (e: any) {
      Alert.alert("Couldn't read that résumé", e?.message ?? 'Try another source.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={busy ? () => {} : onClose}>
      <View style={styles.wrap}>
        <Text style={styles.title}>Import your résumé</Text>
        <Text style={styles.sub}>We'll pull out your skills, headline, and projects. You can still edit everything after.</Text>

        <Text style={styles.label}>PASTE FROM A DOC</Text>
        <TextInput
          value={pasteText}
          onChangeText={setPasteText}
          placeholder="Paste your résumé text here…"
          placeholderTextColor={Brand.inkPlaceholder}
          style={styles.pasteBox}
          multiline
          textAlignVertical="top"
          editable={!busy}
        />
        <Pressable
          onPress={() => run(() => parseResumeText(pasteText.trim()))}
          disabled={pasteText.trim().length < 20 || busy}
          style={[styles.primaryBtn, (pasteText.trim().length < 20 || busy) && styles.disabled]}
        >
          <ClipboardText size={18} color={Brand.inkOnBrand} weight="bold" />
          <Text style={styles.primaryBtnText}>Parse pasted text</Text>
        </Pressable>

        <View style={styles.orRow}>
          <View style={styles.orLine} /><Text style={styles.orText}>OR</Text><View style={styles.orLine} />
        </View>

        <Pressable onPress={() => run(() => pickAndParseDocument(userId))} disabled={busy} style={[styles.altBtn, busy && styles.disabled]}>
          <FileArrowUp size={20} color={Brand.inkPrimary} weight="regular" />
          <Text style={styles.altBtnText}>Upload a file (PDF or Word)</Text>
        </Pressable>
        <Pressable onPress={() => run(() => pickAndParsePhoto(userId))} disabled={busy} style={[styles.altBtn, busy && styles.disabled]}>
          <Camera size={20} color={Brand.inkPrimary} weight="regular" />
          <Text style={styles.altBtnText}>Use a photo of your résumé</Text>
        </Pressable>

        {busy && (
          <View style={styles.busyRow}>
            <ActivityIndicator color={Brand.accent} />
            <Text style={styles.busyText}>Reading your résumé…</Text>
          </View>
        )}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20, paddingBottom: 12 },
  title: { fontFamily: AmbitFont.display, fontSize: 24, color: Brand.inkPrimary },
  sub: { fontFamily: AmbitFont.body, fontSize: 14, color: Brand.inkMuted, marginTop: 8, lineHeight: 20 },
  label: { fontFamily: AmbitFont.body, fontSize: 11, fontWeight: '600', letterSpacing: 1.2, color: Brand.inkLabel, marginTop: 24, marginBottom: 10 },
  pasteBox: {
    fontFamily: AmbitFont.body, fontSize: 15, lineHeight: 22, color: Brand.inkPrimary,
    backgroundColor: Brand.surface1, borderRadius: Radii.lg, borderWidth: 1.5, borderColor: Brand.borderDefault,
    padding: 14, minHeight: 110,
  },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 12, paddingVertical: 14, borderRadius: 999,
    backgroundColor: Brand.action,
    // ASTRA: borderless purple CTA lifted by a soft shadow.
    shadowColor: Brand.action, shadowOpacity: 0.2, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 4,
  },
  primaryBtnText: { fontFamily: AmbitFont.body, fontSize: 15, fontWeight: '700', color: Brand.inkOnBrand },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 18 },
  orLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: Brand.borderDefault },
  orText: { fontFamily: AmbitFont.body, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, color: Brand.inkMuted },
  altBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 15, paddingHorizontal: 16, marginBottom: 10,
    borderRadius: Radii.lg, backgroundColor: Brand.surface1, borderWidth: 1.5, borderColor: Brand.inkEdge,
  },
  altBtnText: { fontFamily: AmbitFont.body, fontSize: 15, fontWeight: '600', color: Brand.inkPrimary },
  busyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 8 },
  busyText: { fontFamily: AmbitFont.body, fontSize: 14, fontWeight: '600', color: Brand.inkBody },
  disabled: { opacity: 0.4 },
});
