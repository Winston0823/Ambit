import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check } from 'phosphor-react-native';
import { LegalModal } from './LegalModal';
import { PRIVACY_POLICY, TERMS_OF_USE, type LegalDoc } from '../../constants/legal';
import { AmbitFont, Brand } from '../../constants/theme';

interface Props {
  agreed: boolean;
  onToggle: () => void;
  /// When true (a gated CTA was tapped un-agreed), the checkbox flags red.
  flagged?: boolean;
}

/// The Terms/Privacy agree-gate row (Guideline 1.2), placed at the moment
/// credentials are collected — sign-in and create-account — rather than on
/// the welcome screen. Self-contained: hosts its own LegalModal for the links.
export function TermsAgreeRow({ agreed, onToggle, flagged }: Props) {
  const [doc, setDoc] = useState<LegalDoc | null>(null);
  return (
    <View>
      <Pressable
        style={styles.row}
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: agreed }}
        accessibilityLabel="I agree to the Terms of Use and Privacy Policy"
      >
        <View style={[styles.box, agreed && styles.boxOn, flagged && !agreed && styles.boxError]}>
          {agreed && <Check size={13} color={Brand.inkOnBrand} weight="bold" />}
        </View>
        <Text style={styles.text}>
          I agree to the{' '}
          <Text style={styles.link} onPress={() => setDoc(TERMS_OF_USE)}>Terms of Use</Text>
          {' '}and{' '}
          <Text style={styles.link} onPress={() => setDoc(PRIVACY_POLICY)}>Privacy Policy</Text>.
        </Text>
      </Pressable>
      <LegalModal doc={doc} onClose={() => setDoc(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 4 },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Brand.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  boxOn: { backgroundColor: Brand.selected, borderColor: Brand.selected },
  boxError: { borderColor: Brand.danger },
  text: { flex: 1, fontFamily: AmbitFont.body, fontSize: 13, lineHeight: 19, color: Brand.inkMuted },
  link: { color: Brand.selected, fontFamily: AmbitFont.semibold },
});
