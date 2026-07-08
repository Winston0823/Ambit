import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DiscoveryCardData, PortfolioItem, ProjectCardData, SeekerCardData } from '../data/mock';
import { Brand } from '../constants/theme';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useProfileRole } from '../hooks/useProfileRole';
import { fetchPortfoliosByUser } from '../lib/portfolio';

interface SavedDeckCtx {
  /// All saved cards in insertion order (newest last).
  saved: DiscoveryCardData[];
  /// Whether a card id is already in the saved list.
  isSaved: (id: string) => boolean;
  /// Add a card snapshot to the saved list. No-op if already saved.
  save: (card: DiscoveryCardData) => void;
  /// Remove by id. No-op if not saved. Also downgrades the backing `matches`
  /// row (deletes it) so the card becomes eligible for the deck again.
  unsave: (id: string) => void;
  /// Private per-card notes (the "sticky note"). Persisted to AsyncStorage
  /// keyed by card id (see note below) so they survive an app restart.
  notes: Record<string, string>;
  /// Set or clear (empty string) a card's note.
  setNote: (id: string, note: string) => void;
  /// Total count — used for badge in the bookmark icon.
  count: number;
}

const SavedDeckContext = createContext<SavedDeckCtx | undefined>(undefined);

const NOTES_KEY = '@ambit/saved_notes';

// Saved-card gradient fallbacks (mirrors the feed's CARD_GRADIENTS family) —
// only used as the hero fallback when a hydrated project/seeker has no image.
const GRADIENTS: [string, string][] = [
  [Brand.primary, Brand.accent],
  ['#C9A57A', Brand.seekerInk],
  [Brand.seekerSurface, Brand.accent],
  ['#E8C9A0', Brand.primary],
  [Brand.accent, '#7A5A38'],
];

interface ProjectRow {
  id: string;
  title: string;
  vibe_blurb: string | null;
  required_skills: string[] | null;
  roles_sought: string[] | null;
  campus_id: string | null;
  image_url: string | null;
  needed_by: string | null;
  owner_id: string;
}

/// Rebuild ProjectCardData snapshots for seeker-side saved rows (a seeker
/// saved these projects). Joins the project rows + their owners so the saved
/// list/carousel render identically to the feed.
async function hydrateSavedProjects(projectIds: string[]): Promise<ProjectCardData[]> {
  if (projectIds.length === 0) return [];
  const { data: projects } = await supabase
    .from('projects')
    .select('id, title, vibe_blurb, required_skills, roles_sought, campus_id, image_url, needed_by, owner_id')
    .in('id', projectIds);
  const rows = (projects ?? []) as ProjectRow[];
  if (rows.length === 0) return [];

  const ownerIds = [...new Set(rows.map((r) => r.owner_id))];
  const { data: owners } = await supabase
    .from('profiles')
    .select('id, name, photo_url, campus_id, response_rate')
    .in('id', ownerIds);
  const ownerMap = Object.fromEntries(
    ((owners ?? []) as { id: string; name: string; photo_url: string | null; campus_id: string | null; response_rate: number | null }[]).map(
      (o) => [o.id, o],
    ),
  );

  // Preserve the caller's ordering (matches insertion order).
  const byId = new Map(rows.map((r) => [r.id, r]));
  return projectIds
    .map((id) => byId.get(id))
    .filter((r): r is ProjectRow => !!r)
    .map((r, i): ProjectCardData => {
      const owner = ownerMap[r.owner_id];
      return {
        kind: 'project',
        id: r.id,
        ownerId: r.owner_id,
        title: r.title,
        pitch: r.vibe_blurb || r.title,
        ownerName: owner?.name ?? 'Unknown',
        ownerPhotoUri: owner?.photo_url ?? null,
        ownerCampusId: r.campus_id ?? owner?.campus_id ?? '',
        whyMatched: 'Saved',
        skillsSought: (r.required_skills ?? []).slice(0, 5),
        rolesSought: r.roles_sought ?? [],
        gradient: GRADIENTS[i % GRADIENTS.length],
        imageUri: r.image_url ?? null,
        neededBy: r.needed_by ?? null,
        responseRate: owner?.response_rate ?? null,
      };
    });
}

/// Rebuild SeekerCardData snapshots for owner-side saved rows (an owner saved
/// these seekers). Ordering preserved to match insertion order.
async function hydrateSavedSeekers(seekerIds: string[]): Promise<SeekerCardData[]> {
  if (seekerIds.length === 0) return [];
  const { data: seekers } = await supabase
    .from('profiles')
    .select('id, name, photo_url, campus_id, skills, vibe_blurb, response_rate')
    .in('id', seekerIds);
  const rows = (seekers ?? []) as {
    id: string;
    name: string;
    photo_url: string | null;
    campus_id: string | null;
    skills: string[] | null;
    vibe_blurb: string | null;
    response_rate: number | null;
  }[];
  if (rows.length === 0) return [];

  const portfolioMap = await fetchPortfoliosByUser(seekerIds).catch(
    () => new Map<string, PortfolioItem[]>(),
  );
  const byId = new Map(rows.map((r) => [r.id, r]));
  return seekerIds
    .map((id) => byId.get(id))
    .filter((r): r is (typeof rows)[number] => !!r && !!r.name?.trim())
    .map((s): SeekerCardData => ({
      kind: 'seeker',
      id: s.id,
      name: s.name.trim(),
      photoUri: s.photo_url,
      campusId: s.campus_id ?? '',
      skills: s.skills ?? [],
      vibeBlurb: s.vibe_blurb ?? '',
      portfolio: portfolioMap.get(s.id) ?? [],
      responseRate: s.response_rate ?? null,
    }));
}

/// Saved-deck store. DB-backed via the `matches` table (outcome = 'saved'):
/// hydrated on mount so saves survive an app restart, and unsave downgrades the
/// row so the card can resurface in the deck. Notes are persisted to
/// AsyncStorage keyed by card id — the `matches.note` column exists (017) but
/// writing it needs a role-aware composite key, so AsyncStorage keeps the
/// note path decoupled from role for v1 (DB-backed notes are a future pass).
export function SavedDeckProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { role, loading: roleLoading } = useProfileRole();
  const [saved, setSaved] = useState<DiscoveryCardData[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  // Owner's project ids — needed to key the `matches` row when an owner
  // unsaves a seeker (row = seeker_id: cardId, project_id: one of these).
  const ownerProjectIds = useRef<string[]>([]);

  // ── Hydrate saved deck from `matches` on sign-in ──────────────────────────
  useEffect(() => {
    if (!user || roleLoading) return;
    let cancelled = false;
    (async () => {
      try {
        if (role === 'owner') {
          const { data: projects } = await supabase
            .from('projects')
            .select('id')
            .eq('owner_id', user.id);
          const projectIds = ((projects ?? []) as { id: string }[]).map((p) => p.id);
          ownerProjectIds.current = projectIds;
          if (projectIds.length === 0) { if (!cancelled) setSaved([]); return; }
          const { data: rows } = await supabase
            .from('matches')
            .select('seeker_id, created_at')
            .in('project_id', projectIds)
            .eq('outcome', 'saved')
            .order('created_at', { ascending: true });
          const seekerIds = [...new Set(((rows ?? []) as { seeker_id: string }[]).map((r) => r.seeker_id))];
          const cards = await hydrateSavedSeekers(seekerIds);
          if (!cancelled) setSaved(cards);
        } else {
          const { data: rows } = await supabase
            .from('matches')
            .select('project_id, created_at')
            .eq('seeker_id', user.id)
            .eq('outcome', 'saved')
            .order('created_at', { ascending: true });
          const projectIds = ((rows ?? []) as { project_id: string }[]).map((r) => r.project_id);
          const cards = await hydrateSavedProjects(projectIds);
          if (!cancelled) setSaved(cards);
        }
      } catch {
        // Hydration is best-effort — a failure leaves the in-memory list empty
        // rather than crashing the provider.
      }
    })();
    return () => { cancelled = true; };
  }, [user, role, roleLoading]);

  // ── Load persisted notes once ─────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(NOTES_KEY);
        if (!cancelled && raw) setNotes(JSON.parse(raw) as Record<string, string>);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  const isSaved = useCallback(
    (id: string) => saved.some((c) => c.id === id),
    [saved],
  );

  const save = useCallback((card: DiscoveryCardData) => {
    setSaved((prev) => (prev.some((c) => c.id === card.id) ? prev : [...prev, card]));
  }, []);

  /// Downgrade the backing match row so the card can resurface in the deck,
  /// then drop it from the in-memory list. Mirrors the feed rewind path.
  const deleteMatchRow = useCallback(
    (card: DiscoveryCardData) => {
      if (!user) return;
      if (card.kind === 'project' || role !== 'owner') {
        supabase
          .from('matches')
          .delete()
          .eq('seeker_id', user.id)
          .eq('project_id', card.id)
          .then(() => {});
      } else {
        // Owner un-saving a seeker: seeker_id = card.id, project_id in mine.
        const q = supabase.from('matches').delete().eq('seeker_id', card.id);
        (ownerProjectIds.current.length > 0
          ? q.in('project_id', ownerProjectIds.current)
          : q
        ).then(() => {});
      }
    },
    [user, role],
  );

  const unsave = useCallback(
    (id: string) => {
      setSaved((prev) => {
        const card = prev.find((c) => c.id === id);
        if (card) deleteMatchRow(card);
        return prev.filter((c) => c.id !== id);
      });
    },
    [deleteMatchRow],
  );

  const setNote = useCallback((id: string, note: string) => {
    setNotes((prev) => {
      const next = { ...prev };
      if (note.trim()) next[id] = note.trim();
      else delete next[id];
      AsyncStorage.setItem(NOTES_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo<SavedDeckCtx>(
    () => ({ saved, isSaved, save, unsave, notes, setNote, count: saved.length }),
    [saved, isSaved, save, unsave, notes, setNote],
  );

  return (
    <SavedDeckContext.Provider value={value}>{children}</SavedDeckContext.Provider>
  );
}

export function useSavedDeck(): SavedDeckCtx {
  const ctx = useContext(SavedDeckContext);
  if (!ctx) throw new Error('useSavedDeck must be used inside SavedDeckProvider');
  return ctx;
}
