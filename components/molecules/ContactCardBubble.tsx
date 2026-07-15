import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { AddressBook, Envelope, GithubLogo, Globe, LinkedinLogo, Phone } from 'phosphor-react-native';
import type { ContactCard } from '../../lib/messaging';
import { AmbitFont, Astra, Brand, Radii } from '../../constants/theme';

interface Props {
  card:   ContactCard;
  isMine: boolean;
}

/// Only ever open http/https URLs — reject javascript:, data:, tel:, custom
/// app schemes, and anything with whitespace/control chars. A bare host gets
/// https:// prepended. Returns null when the value can't be made safe.
function safeHttpUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let u = raw.trim();
  if (!u || /\s/.test(u)) return null;
  if (!/^https?:\/\//i.test(u)) {
    if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return null; // some other scheme → reject
    u = 'https://' + u;
  }
  return u;
}

/// A plausible single email with no characters that could inject extra mailto
/// headers (?, &, commas, CR/LF, angle brackets). Returns null otherwise.
function safeEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const e = raw.trim();
  return /^[^\s@,;:<>()"?&]+@[^\s@,;:<>()"?&]+\.[^\s@,;:<>()"?&]+$/.test(e) ? e : null;
}

/// A dialable phone: digits with optional leading +, spaces, dashes, parens.
/// Returns the display value + a stripped tel: target, or null if implausible.
function safePhone(raw: string | null | undefined): { display: string; tel: string } | null {
  if (!raw) return null;
  const p = raw.trim();
  if (!/^\+?[\d\s().-]{7,20}$/.test(p)) return null;
  const tel = p.replace(/[^\d+]/g, '');
  return tel.length >= 7 ? { display: p, tel: `tel:${tel}` } : null;
}

/// Contact-info card rendered in place of a normal bubble when a message carries
/// a `contact_card` snapshot. Clean informational card (not the dark
/// image-forward attachment shell) — name, email, and profile links, each row
/// tappable to open. ASTRA: cream surface, lilac hairline, royal accents.
export function ContactCardBubble({ card, isMine }: Props) {
  const open = (url: string) => Linking.openURL(url).catch(() => {});
  // Sanitize every actionable value before it becomes a tappable link. Rows
  // that don't sanitize cleanly are dropped rather than shown as a bad link.
  const email = safeEmail(card.email);
  const phone = safePhone(card.phone);
  const gh    = safeHttpUrl(card.github_url);
  const li    = safeHttpUrl(card.linkedin_url);
  const site  = safeHttpUrl(card.portfolio_url);
  const rows: { key: string; Icon: typeof Envelope; label: string; url: string }[] = [];
  if (email) rows.push({ key: 'email', Icon: Envelope, label: email, url: `mailto:${email}` });
  if (phone) rows.push({ key: 'phone', Icon: Phone, label: phone.display, url: phone.tel });
  if (gh)    rows.push({ key: 'gh', Icon: GithubLogo, label: 'GitHub', url: gh });
  if (li)    rows.push({ key: 'li', Icon: LinkedinLogo, label: 'LinkedIn', url: li });
  if (site)  rows.push({ key: 'site', Icon: Globe, label: 'Portfolio', url: site });

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
