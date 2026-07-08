import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'phosphor-react-native';
import type { LegalDoc } from '../../constants/legal';
import { AmbitFont, Brand, Space } from '../../constants/theme';

/// Render a string with **bold** spans into Text runs. `bullet` prepends a dot.
function renderRuns(text: string, bullet?: boolean): React.ReactNode {
  const runs = text
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((p, i) =>
      p.startsWith('**') && p.endsWith('**')
        ? <Text key={i} style={styles.boldRun}>{p.slice(2, -2)}</Text>
        : <Text key={i}>{p}</Text>,
    );
  return bullet ? <>{'•  '}{runs}</> : <>{runs}</>;
}

interface Props {
  /// The doc to show, or null to hide the modal.
  doc: LegalDoc | null;
  onClose: () => void;
}

/// Full-screen reader for the Terms of Use / Privacy Policy. Content lives in
/// constants/legal.ts so the same source can be hosted for App Store Connect.
export function LegalModal({ doc, onClose }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={!!doc} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <View style={styles.root}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
            <X size={22} color={Brand.inkMuted} weight="bold" />
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
        >
          {doc && (
            <>
              <Text style={styles.title}>{doc.title}</Text>
              <Text style={styles.updated}>Updated {doc.updated}</Text>
              <Text style={styles.intro}>{renderRuns(doc.intro)}</Text>
              {doc.sections.map((s) => (
                <View key={s.heading} style={styles.section}>
                  <Text style={styles.heading}>{s.heading}</Text>
                  {s.body.split('\n').map((line, i) => {
                    const trimmed = line.trim();
                    if (!trimmed) return null;
                    const isBullet = trimmed.startsWith('• ');
                    return (
                      <Text key={i} style={[styles.para, isBullet && styles.bulletPara]}>
                        {renderRuns(isBullet ? trimmed.slice(2) : trimmed, isBullet)}
                      </Text>
                    );
                  })}
                </View>
              ))}
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.canvas },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: Space.lg,
    paddingBottom: 8,
  },
  content: { paddingHorizontal: Space.lg, paddingTop: 4 },
  // Apple-style: big centered title + "Updated …" under it, then a lead intro.
  title: {
    fontFamily: AmbitFont.display,
    fontSize: 28,
    color: Brand.inkPrimary,
    textAlign: 'center',
  },
  updated: {
    fontFamily: AmbitFont.body,
    fontSize: 12.5,
    color: Brand.inkMuted,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 20,
  },
  intro: {
    fontFamily: AmbitFont.body,
    fontSize: 15,
    lineHeight: 23,
    color: Brand.inkBody,
    marginBottom: 28,
  },
  section: { marginBottom: 24 },
  heading: {
    fontFamily: AmbitFont.display,
    fontSize: 18,
    color: Brand.inkPrimary,
    marginBottom: 10,
  },
  para: { fontFamily: AmbitFont.body, fontSize: 14, lineHeight: 21, color: Brand.inkBody, marginTop: 8 },
  bulletPara: { marginTop: 6, paddingLeft: 4 },
  boldRun: { fontFamily: AmbitFont.semibold, color: Brand.inkPrimary },
});
