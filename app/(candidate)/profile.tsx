import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  GithubLogo,
  LinkedinLogo,
  Globe,
  FileText,
  MapPin,
  PencilSimpleLine,
  SignOut,
} from 'phosphor-react-native';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { CAMPUSES } from '../../data/mock';
import { Brand, AmbitFont, Radii, Space } from '../../constants/theme';

interface ProfileRow {
  id: string;
  edu_email: string | null;
  demographic: 'student' | 'professor' | null;
  name: string | null;
  vibe_blurb: string | null;
  skills: string[] | null;
  role: 'owner' | 'seeker' | 'both' | null;
  campus_id: string | null;
  photo_url: string | null;
  github_url: string | null;
  linkedin_url: string | null;
  portfolio_url: string | null;
  resume_url: string | null;
}

const ROLE_LABEL: Record<NonNullable<ProfileRow['role']>, string> = {
  owner: 'Project Owner',
  seeker: 'Project Seeker',
  both: 'Owner & Seeker',
};

/// S-090 My Profile.
///
/// Loads the signed-in user's profile row from Supabase and presents it as
/// a warm, editorial profile card — hero photo + name + role pill, vibe
/// blurb, skill chips, and proof-link icons. Falls back gracefully if any
/// field is empty (newly-onboarded users may have minimal data).
export default function ProfileTab() {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      if (cancelled) return;
      setProfile(data as ProfileRow | null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  const campus = useMemo(
    () => CAMPUSES.find((c) => c.id === profile?.campus_id) ?? null,
    [profile?.campus_id],
  );

  if (loading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={Brand.accent} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      {/* Hero — photo + name + role pill. Warm tan card sits above a
          clean canvas to anchor identity at the top of the scroll. */}
      <View style={styles.hero}>
        <View style={styles.avatarWrap}>
          {profile?.photo_url ? (
            <Image source={{ uri: profile.photo_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarFallbackText}>
                {(profile?.name ?? '?').slice(0, 1).toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.name}>{profile?.name ?? 'Your name'}</Text>

        <View style={styles.metaRow}>
          {profile?.role && (
            <View style={styles.rolePill}>
              <Text style={styles.rolePillText}>{ROLE_LABEL[profile.role]}</Text>
            </View>
          )}
          {campus && (
            <View style={styles.campusRow}>
              <MapPin size={14} color={Brand.inkLabel} weight="regular" />
              <Text style={styles.campusText}>{campus.name}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Vibe blurb — label removed; the prose stands on its own. */}
      <View style={styles.section}>
        {profile?.vibe_blurb ? (
          <Text style={styles.body}>{profile.vibe_blurb}</Text>
        ) : (
          <Text style={styles.bodyMuted}>Tap edit to add your vibe.</Text>
        )}
      </View>

      {/* Skills */}
      {profile?.skills && profile.skills.length > 0 && (
        <Section eyebrow="GOOD AT">
          <View style={styles.chipRow}>
            {profile.skills.map((tag) => (
              <View key={tag} style={styles.chip}>
                <Text style={styles.chipText}>{tag}</Text>
              </View>
            ))}
          </View>
        </Section>
      )}

      {/* Proof links */}
      <Section eyebrow="LINKS">
        <View style={styles.linkColumn}>
          <ProofLink Icon={GithubLogo}   label="GitHub"    url={profile?.github_url} />
          <ProofLink Icon={LinkedinLogo} label="LinkedIn"  url={profile?.linkedin_url} />
          <ProofLink Icon={Globe}        label="Portfolio" url={profile?.portfolio_url} />
          <ProofLink Icon={FileText}     label="Resume"    url={profile?.resume_url} />
        </View>
      </Section>

      {/* Edit + sign-out. Edit is a placeholder for now — would re-open
          the onboarding flow at the first step on tap. */}
      <View style={styles.actions}>
        <Pressable style={styles.actionButton}>
          <PencilSimpleLine size={18} color={Brand.inkPrimary} weight="regular" />
          <Text style={styles.actionLabel}>Edit profile</Text>
        </Pressable>
        <Pressable style={styles.actionButton} onPress={() => { signOut().catch(() => {}); }}>
          <SignOut size={18} color={Brand.inkPrimary} weight="regular" />
          <Text style={styles.actionLabel}>Sign out</Text>
        </Pressable>
      </View>

      <View style={styles.footerSpace} />
    </ScrollView>
  );
}

function Section({ eyebrow, children }: { eyebrow: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      {children}
    </View>
  );
}

interface ProofLinkProps {
  Icon: React.ComponentType<{ size: number; color: string; weight?: 'regular' | 'fill' }>;
  label: string;
  url: string | null | undefined;
}

function ProofLink({ Icon, label, url }: ProofLinkProps) {
  const hasUrl = !!url && url.trim().length > 0;
  return (
    <View style={[styles.proofRow, !hasUrl && styles.proofRowMuted]}>
      <Icon size={20} color={hasUrl ? Brand.seekerInk : Brand.inkPlaceholder} weight="regular" />
      <View style={styles.proofText}>
        <Text style={styles.proofLabel}>{label}</Text>
        {hasUrl ? (
          <Text style={styles.proofUrl} numberOfLines={1}>{url}</Text>
        ) : (
          <Text style={styles.proofUrlMuted}>Not added</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.canvas },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: Space.lg, paddingTop: Space.lg, gap: Space.lg },

  hero: {
    backgroundColor: Brand.seekerSurface,
    borderRadius: Radii.lg,
    paddingVertical: 28,
    paddingHorizontal: Space.lg,
    alignItems: 'center',
  },
  avatarWrap: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: Brand.canvas,
    padding: 4,
    marginBottom: 16,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  avatarFallback: {
    backgroundColor: Brand.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    fontFamily: AmbitFont.display,
    fontSize: 36,
    color: Brand.inkLabel,
  },
  name: {
    fontFamily: AmbitFont.display,
    fontSize: 28,
    color: Brand.seekerInk,
    textAlign: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  rolePill: {
    backgroundColor: Brand.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  rolePillText: {
    fontFamily: AmbitFont.body,
    fontSize: 11,
    fontWeight: '600',
    color: Brand.inkOnBrand,
    letterSpacing: 0.2,
  },
  campusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  campusText: {
    fontFamily: AmbitFont.body,
    fontSize: 13,
    color: Brand.inkLabel,
  },

  section: { gap: 10 },
  eyebrow: {
    fontFamily: AmbitFont.body,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
    color: Brand.inkLabel,
  },
  body: {
    fontFamily: AmbitFont.body,
    fontSize: 15,
    color: Brand.inkBody,
    lineHeight: 22,
  },
  bodyMuted: {
    fontFamily: AmbitFont.body,
    fontSize: 15,
    color: Brand.inkPlaceholder,
    lineHeight: 22,
  },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: Brand.surface1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Brand.borderDefault,
  },
  chipText: {
    fontFamily: AmbitFont.body,
    fontSize: 13,
    color: Brand.inkHigh,
    fontWeight: '600',
  },

  linkColumn: { gap: 12 },
  proofRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: Brand.surface1,
    borderRadius: Radii.md,
  },
  proofRowMuted: { opacity: 0.6 },
  proofText: { flex: 1 },
  proofLabel: {
    fontFamily: AmbitFont.body,
    fontSize: 13,
    fontWeight: '600',
    color: Brand.inkLabel,
    letterSpacing: 0.2,
  },
  proofUrl: {
    fontFamily: AmbitFont.body,
    fontSize: 14,
    color: Brand.inkBody,
    marginTop: 2,
  },
  proofUrlMuted: {
    fontFamily: AmbitFont.body,
    fontSize: 14,
    color: Brand.inkPlaceholder,
    marginTop: 2,
  },

  actions: { gap: 8, marginTop: 8 },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: Brand.surface1,
    borderRadius: Radii.md,
  },
  actionLabel: {
    fontFamily: AmbitFont.body,
    fontSize: 15,
    fontWeight: '600',
    color: Brand.inkPrimary,
  },

  footerSpace: { height: 100 },
});
