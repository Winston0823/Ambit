import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CaretRight } from 'phosphor-react-native';
import { Chip } from '../atoms';
import { AmbitFont, Brand } from '../../constants/theme';

export interface OwnerProject {
  id: string;
  title: string;
  pitch: string;
  roles: string[];
}

interface Props {
  name: string;
  photoUri: string | null;
  campusName: string | null;
  vibe: string;
  skills: string[];
  projects: OwnerProject[];
  onProjectPress?: (id: string) => void;
}

/// Warm tan thumbnail gradients, rotated per project.
const THUMBS: [string, string][] = [
  ['#C9A886', '#6A4A28'],
  ['#9EC5A8', '#3A5544'],
  ['#D9B6F0', '#5A3F7A'],
  ['#E8C9A0', '#B48045'],
];

/// The canonical "owner" card — clean, light, roles-forward. Identity is
/// compact (rounded-square avatar matching the chat pfp container); the live
/// projects lead. Reused as the owner's own profile Preview AND as what a
/// seeker sees when they tap an owner. Seekers sell themselves (DiscoveryCard);
/// owners sell the opportunity (this).
export function OwnerProfileCard({ name, photoUri, campusName, vibe, skills, projects, onProjectPress }: Props) {
  const initial = (name?.trim()?.[0] ?? '?').toUpperCase();
  const subtitle = ['Founder', campusName, `${projects.length} live project${projects.length === 1 ? '' : 's'}`]
    .filter(Boolean)
    .join('  ·  ');

  return (
    <View style={styles.card}>
      <View style={styles.idz}>
        <View style={styles.idRow}>
          <View style={styles.avatar}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.avatarImg} />
            ) : (
              <LinearGradient colors={['#C9A886', '#7A5A3A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatarImg}>
                <Text style={styles.avatarInitial}>{initial}</Text>
              </LinearGradient>
            )}
          </View>
          <View style={styles.idText}>
            <Text style={styles.name} numberOfLines={1}>{name || 'Your name'}</Text>
            <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
          </View>
        </View>

        {!!vibe && <Text style={styles.vibe}>{vibe}</Text>}

        {skills.length > 0 && (
          <View style={styles.chips}>
            {skills.slice(0, 6).map((s) => (
              <Chip key={s} label={s} selected={false} />
            ))}
          </View>
        )}
      </View>

      <View style={styles.divider} />

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
        <View style={styles.secLabel}>
          <Text style={styles.secLabelText}>LIVE PROJECTS</Text>
          {projects.length > 0 && <Text style={styles.secCount}>{projects.length} active</Text>}
        </View>

        {projects.length === 0 ? (
          <Text style={styles.empty}>No live projects yet.</Text>
        ) : (
          projects.map((p, i) => (
            <Pressable
              key={p.id}
              onPress={() => onProjectPress?.(p.id)}
              style={[styles.proj, i < projects.length - 1 && styles.projDivider]}
              accessibilityLabel={`Open ${p.title}`}
            >
              <LinearGradient colors={THUMBS[i % THUMBS.length]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.thumb} />
              <View style={styles.projBody}>
                <Text style={styles.projTitle} numberOfLines={1}>{p.title}</Text>
                {!!p.pitch && <Text style={styles.projPitch} numberOfLines={1}>{p.pitch}</Text>}
                {p.roles.length > 0 && (
                  <Text style={styles.roles} numberOfLines={1}>Looking for · {p.roles.join(' · ')}</Text>
                )}
              </View>
              <CaretRight size={18} color={Brand.borderDefault} weight="bold" />
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 26,
    backgroundColor: Brand.cardCream,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Brand.borderSoft,
    overflow: 'hidden',
    shadowColor: '#3C2814',
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  idz: { padding: 22 },
  idRow: { flexDirection: 'row', gap: 15, alignItems: 'center' },
  avatar: { width: 64, height: 64, borderRadius: 18, overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontFamily: AmbitFont.display, fontSize: 26, color: '#F5E9D8' },
  idText: { flex: 1, minWidth: 0 },
  name: { fontFamily: AmbitFont.display, fontSize: 25, color: Brand.inkPrimary, lineHeight: 28 },
  subtitle: { fontFamily: AmbitFont.body, fontSize: 13, color: Brand.inkMuted, marginTop: 4 },
  vibe: { fontFamily: AmbitFont.body, fontSize: 14.5, color: Brand.inkBody, lineHeight: 21, marginTop: 15 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 14 },

  divider: { height: StyleSheet.hairlineWidth, backgroundColor: Brand.borderSoft, marginHorizontal: 22 },

  body: { flex: 1 },
  bodyContent: { padding: 18, paddingTop: 16 },
  secLabel: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14, paddingHorizontal: 2 },
  secLabelText: { fontFamily: AmbitFont.body, fontSize: 11, fontWeight: '700', letterSpacing: 1.3, color: Brand.inkLabel },
  secCount: { fontFamily: AmbitFont.body, fontSize: 12, fontWeight: '600', color: Brand.accent },
  empty: { fontFamily: AmbitFont.body, fontSize: 14, color: Brand.inkMuted, paddingHorizontal: 2, paddingVertical: 8 },

  proj: { flexDirection: 'row', gap: 14, alignItems: 'center', paddingBottom: 16, marginBottom: 16 },
  projDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Brand.borderSoft },
  thumb: { width: 62, height: 62, borderRadius: 15 },
  projBody: { flex: 1, minWidth: 0 },
  projTitle: { fontFamily: AmbitFont.display, fontSize: 18, color: Brand.inkPrimary },
  projPitch: { fontFamily: AmbitFont.body, fontSize: 12.5, color: Brand.inkMuted, marginTop: 2 },
  roles: { fontFamily: AmbitFont.body, fontSize: 11.5, fontWeight: '600', color: Brand.accent, marginTop: 8 },
});
