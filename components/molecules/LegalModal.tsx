import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'phosphor-react-native';
import type { LegalDoc } from '../../constants/legal';
import { AmbitFont, Brand, Space } from '../../constants/theme';

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
          <Text style={styles.headerTitle} numberOfLines={1}>{doc?.title ?? ''}</Text>
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
              <Text style={styles.updated}>Last updated {doc.updated}</Text>
              {doc.sections.map((s) => (
                <View key={s.heading} style={styles.section}>
                  <Text style={styles.heading}>{s.heading}</Text>
                  {s.body.split('\n\n').map((para, i) => {
                    const isBullet = para.trimStart().startsWith('• ');
                    return (
                      <Text key={i} style={[styles.para, isBullet && styles.bullet]}>
                        {para}
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
    justifyContent: 'space-between',
    paddingHorizontal: Space.lg,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Brand.borderDefault,
  },
  headerTitle: { fontFamily: AmbitFont.display, fontSize: 20, color: Brand.inkPrimary, flex: 1 },
  content: { paddingHorizontal: Space.lg, paddingTop: 16 },
  updated: { fontFamily: AmbitFont.body, fontSize: 12.5, color: Brand.inkMuted, marginBottom: 20 },
  section: { marginBottom: 22 },
  heading: { fontFamily: AmbitFont.semibold, fontSize: 15, color: Brand.inkPrimary, marginBottom: 8 },
  para: { fontFamily: AmbitFont.body, fontSize: 14, lineHeight: 21, color: Brand.inkBody, marginTop: 8 },
  bullet: { marginTop: 4 },
});
