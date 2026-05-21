import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import type { DiscoveryCardData } from '../data/mock';

interface SavedDeckCtx {
  /// All saved cards in insertion order (newest last).
  saved: DiscoveryCardData[];
  /// Whether a card id is already in the saved list.
  isSaved: (id: string) => boolean;
  /// Add a card snapshot to the saved list. No-op if already saved.
  save: (card: DiscoveryCardData) => void;
  /// Remove by id. No-op if not saved.
  unsave: (id: string) => void;
  /// Total count — used for badge in the bookmark icon.
  count: number;
}

const SavedDeckContext = createContext<SavedDeckCtx | undefined>(undefined);

/// In-memory saved-deck store. v1 is session-only; v2 moves to a
/// `saved_cards` Supabase table keyed by user_id.
export function SavedDeckProvider({ children }: { children: ReactNode }) {
  const [saved, setSaved] = useState<DiscoveryCardData[]>([]);

  const isSaved = useCallback(
    (id: string) => saved.some((c) => c.id === id),
    [saved],
  );

  const save = useCallback((card: DiscoveryCardData) => {
    setSaved((prev) => (prev.some((c) => c.id === card.id) ? prev : [...prev, card]));
  }, []);

  const unsave = useCallback((id: string) => {
    setSaved((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const value = useMemo<SavedDeckCtx>(
    () => ({ saved, isSaved, save, unsave, count: saved.length }),
    [saved, isSaved, save, unsave],
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
