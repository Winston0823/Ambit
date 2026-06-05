import { supabase } from './supabase';
import type { PortfolioItem } from '../data/mock';
import { Brand } from '../constants/theme';
import { readLocalFileAsArrayBuffer } from './messaging';

/// Columns selected for a portfolio row everywhere below.
const PORTFOLIO_COLS = 'id, user_id, title, description, image_url, position, timeframe, contributions, link_url, tools';

/// Placeholder gradient rotation when an item has no uploaded image.
/// Indexed by position (mod length) so each bubble in a user's set looks
/// distinct without persisting the gradient choice in the DB.
const PORTFOLIO_GRADIENTS: [string, string][] = [
  [Brand.primary, Brand.accent],
  ['#C9A57A', Brand.seekerInk],
  [Brand.seekerSurface, Brand.accent],
  ['#E8C9A0', Brand.primary],
  [Brand.accent, '#7A5A38'],
];

interface PortfolioRow {
  id: string;
  user_id: string;
  title: string;
  description: string;
  image_url: string | null;
  position: number;
  timeframe: string | null;
  contributions: string[] | null;
  link_url: string | null;
  tools: string[] | null;
}

const rowToItem = (row: PortfolioRow): PortfolioItem => ({
  id: row.id,
  imageUri: row.image_url,
  title: row.title,
  description: row.description,
  gradient: PORTFOLIO_GRADIENTS[row.position % PORTFOLIO_GRADIENTS.length],
  timeframe: row.timeframe ?? '',
  contributions: row.contributions ?? [],
  linkUrl: row.link_url ?? null,
  tools: row.tools ?? [],
});

/// Load one user's portfolio, ordered by position. Used by:
///   - profile.tsx for the WYSIWYG editor
///   - feed.tsx fetchSeekerDeck (bulk variant below) to surface
///     portfolio bubbles on seeker cards in discovery
export async function fetchPortfolioForUser(userId: string): Promise<PortfolioItem[]> {
  const { data, error } = await supabase
    .from('portfolio_items')
    .select(PORTFOLIO_COLS)
    .eq('user_id', userId)
    .order('position', { ascending: true });
  if (error) {
    if (!error.message.includes('schema cache')) {
      console.warn('fetchPortfolioForUser failed:', error.message);
    }
    return [];
  }
  return (data as PortfolioRow[]).map(rowToItem);
}

/// Bulk version — load portfolio for many users in one query, returns a
/// Map<userId, PortfolioItem[]>. Used by feed.tsx fetchSeekerDeck to
/// avoid N+1 queries when populating the discovery deck.
export async function fetchPortfoliosByUser(
  userIds: string[],
): Promise<Map<string, PortfolioItem[]>> {
  if (userIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from('portfolio_items')
    .select(PORTFOLIO_COLS)
    .in('user_id', userIds)
    .order('position', { ascending: true });
  const out = new Map<string, PortfolioItem[]>();
  if (error || !data) {
    if (error && !error.message.includes('schema cache')) {
      console.warn('fetchPortfoliosByUser failed:', error.message);
    }
    return out;
  }
  for (const row of data as PortfolioRow[]) {
    const bucket = out.get(row.user_id) ?? [];
    bucket.push(rowToItem(row));
    out.set(row.user_id, bucket);
  }
  return out;
}

/// Insert OR update by id. Position defaults to "append to end" by
/// querying the user's current max position, but the caller can pass an
/// explicit position to preserve ordering on updates. Returns the saved
/// item with its real DB id.
export async function upsertPortfolioItem(args: {
  userId: string;
  /// For new items, pass a client-side UUID (e.g. randomUUID from
  /// expo-crypto). For existing items, pass the existing id.
  id: string;
  title: string;
  description: string;
  imageUrl?: string | null;
  timeframe?: string;
  contributions?: string[];
  linkUrl?: string | null;
  tools?: string[];
  /// Optional explicit position. Omit to append.
  position?: number;
}): Promise<PortfolioItem> {
  let position = args.position;
  if (position == null) {
    const { data: maxRow } = await supabase
      .from('portfolio_items')
      .select('position')
      .eq('user_id', args.userId)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle();
    position = ((maxRow as { position: number } | null)?.position ?? -1) + 1;
  }

  const { data, error } = await supabase
    .from('portfolio_items')
    .upsert(
      {
        id:            args.id,
        user_id:       args.userId,
        title:         args.title,
        description:   args.description,
        image_url:     args.imageUrl ?? null,
        timeframe:     args.timeframe?.trim() || null,
        contributions: args.contributions ?? [],
        link_url:      args.linkUrl?.trim() || null,
        tools:         args.tools ?? [],
        position,
      },
      { onConflict: 'id' },
    )
    .select(PORTFOLIO_COLS)
    .single();
  if (error) throw error;
  return rowToItem(data as PortfolioRow);
}

/// Bulk-load the highlights referenced by portfolio-attachment messages,
/// keyed by id. Mirrors messaging.fetchProjectRefs.
export async function fetchPortfolioRefs(ids: string[]): Promise<Map<string, PortfolioItem>> {
  const out = new Map<string, PortfolioItem>();
  if (ids.length === 0) return out;
  const { data } = await supabase.from('portfolio_items').select(PORTFOLIO_COLS).in('id', ids);
  for (const r of (data ?? []) as PortfolioRow[]) out.set(r.id, rowToItem(r));
  return out;
}

export async function deletePortfolioItem(id: string): Promise<void> {
  const { error } = await supabase.from('portfolio_items').delete().eq('id', id);
  if (error) throw error;
}

/// Upload a picked cover image to the `portfolio-images` bucket and return its
/// public URL. Path convention `{userId}/{itemId}.{ext}` with upsert:true so
/// replacing a highlight's image overwrites in place. A cache-busting query
/// param forces the CDN/Image cache to refresh the swapped image.
/// Reads real bytes via expo-file-system (fetch().blob() yields 0-byte
/// uploads on RN — see readLocalFileAsArrayBuffer).
export async function uploadPortfolioImage(
  userId: string,
  itemId: string,
  localUri: string,
  nowMs: number,
): Promise<string> {
  const ext = (localUri.match(/\.([a-zA-Z0-9]+)$/)?.[1] ?? 'jpg').toLowerCase();
  const path = `${userId}/${itemId}.${ext}`;
  const bytes = await readLocalFileAsArrayBuffer(localUri);
  const { error } = await supabase.storage
    .from('portfolio-images')
    .upload(path, bytes, {
      contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
      upsert: true,
    });
  if (error) throw error;
  const { data } = supabase.storage.from('portfolio-images').getPublicUrl(path);
  return `${data.publicUrl}?v=${nowMs}`;
}
