import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { AddressBook, Envelope, GithubLogo, Globe, LinkedinLogo } from 'phosphor-react-native';
import type { ContactCard } from '../../lib/messaging';
import { AmbitFont, Astra, Brand, Radii } from '../../constants/theme';

interface Props {
  card:   ContactCard;
  isMine: boolean;
}

/// Contact-info card rendered in place of a normal bubble when a message carries
/// a `contact_card` snapshot. Clean informational card (not the dark
/// image-forward attachment shell) — name, email, and profile links, each row
/// tappable to open. ASTRA: cream surface, lilac hairline, royal accents.
export function ContactCardBubble({ card, isMine }: Props) {
  const open = (url: string) => Linking.openURL(url).catch(() => {});
  const rows: { key: string; Icon: typeof Envelope; label: string; url: string }[] = [];
  if (card.email) rows.push({ key: 'email', Icon: Envelope, label: card.email, url: `mailto:${card.email}` });
  if (card.github_url) rows.push({ key: 'gh', Icon: GithubLogo, label: 'GitHub', url: card.github_url });
  if (card.linkedin_url) rows.push({ key: 'li', Icon: LinkedinLogo, label: 'LinkedIn', url: card.linkedin_url });
  if (card.portfolio_url) rows.push({ key: 'site', Icon: Globe, label: 'Portfolio', url: card.portfolio_url });

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <AddressBook size={18} color={Brand.selected} weight="fill" />
        <Text style={styles.eyebrow}>{isMine ? 'You shared your contact' : 'Contact info'}</Text>
      </View>
      {!!card.name && <Text style={styles.name} numberOfLines={1}>{card.name}</Text>}

      <View style={styles.rows}>
        {rows.map((r, i) => (
          <Pressable
            key={r.key}
            onPress={() => open(r.url)}
            style={({ pressed }) => [styles.row, i > 0 && styles.rowDivider, pressed && { opacity: 0.6 }]}
            accessibilityRole="button"
            accessibilityLabel={`Open ${r.label}`}
          >
            <r.Icon size={17} color={Brand.selected} weight="regular" />
            <Text style={styles.rowLabel} numberOfLines={1}>{r.label}</Text>
          </Pressable>
        ))}
        {rows.length === 0 && <Text style={styles.empty}>No contact details shared.</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 262,
    borderRadius: 16,
    backgroundColor: Brand.cardCream,
    borderWidth: 1,
    borderColor: Astra.hairlinePurple,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  eyebrow: {
    fontFamily: AmbitFont.bold,
    fontSize: 9.5,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: Brand.selected,
  },
  name: { fontFamily: AmbitFont.display, fontSize: 19, color: Brand.inkPrimary, letterSpacing: -0.2 },
  rows: { marginTop: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 10 },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Astra.hairlinePurple },
  rowLabel: { flex: 1, fontFamily: AmbitFont.body, fontSize: 14, color: Brand.inkBody },
  empty: { fontFamily: AmbitFont.body, fontSize: 13, color: Brand.inkMuted, paddingVertical: 6 },
});
