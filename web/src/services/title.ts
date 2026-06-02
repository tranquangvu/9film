import type { BrowseResult, ImdbTitle } from '@/utils/title';
import { normId, origLang } from '@/utils/title';

export async function getTitle(imdbId: string, signal?: AbortSignal): Promise<ImdbTitle> {
  const id = encodeURIComponent(normId(imdbId));
  const res = await fetch(`/api/title/${id}`, { signal });
  const json = (await res.json()) as ImdbTitle & { error?: string };

  if (!res.ok) {
    throw new Error(json.error ?? `Title details failed (${res.status})`);
  }
  if (!json.id) {
    throw new Error('No title details returned');
  }
  return json;
}

export async function searchTitles(q: string, limit = 20, signal?: AbortSignal): Promise<ImdbTitle[]> {
  const params = new URLSearchParams({ q, limit: String(limit) });
  const res = await fetch(`/api/title/search?${params}`, { signal });
  const json = (await res.json()) as { titles?: ImdbTitle[]; error?: string };
  if (!res.ok) throw new Error(json.error ?? `Search failed (${res.status})`);
  return json.titles ?? [];
}

export async function getTrendingTitles(limit = 10, signal?: AbortSignal): Promise<ImdbTitle[]> {
  const res = await fetch(`/api/title/trending?limit=${limit}`, { signal });
  const json = (await res.json()) as { titles?: ImdbTitle[]; error?: string };
  if (!res.ok) throw new Error(json.error ?? `Trending titles failed (${res.status})`);
  return json.titles ?? [];
}

export async function browseTitles(
  opts: { type?: string; genre?: string; first?: number; after?: string; minRating?: number; sort?: string },
  signal?: AbortSignal,
): Promise<BrowseResult> {
  const params = new URLSearchParams();
  if (opts.type) params.set('type', opts.type);
  if (opts.genre) params.set('genre', opts.genre);
  if (opts.first) params.set('first', String(opts.first));
  if (opts.after) params.set('after', opts.after);
  if (opts.minRating != null) params.set('minRating', String(opts.minRating));
  if (opts.sort) params.set('sort', opts.sort);

  const res = await fetch(`/api/title/browse?${params}`, { signal });
  const json = (await res.json()) as BrowseResult & { error?: string };
  if (!res.ok) throw new Error(json.error ?? `Browse failed (${res.status})`);
  return { titles: json.titles ?? [], hasNextPage: json.hasNextPage ?? false, endCursor: json.endCursor };
}

export async function getSimilarTitles(imdbId: string, limit = 6, signal?: AbortSignal): Promise<ImdbTitle[]> {
  const id = encodeURIComponent(normId(imdbId));
  const res = await fetch(`/api/title/${id}/similar?limit=${limit}`, { signal });
  const json = (await res.json()) as { titles?: ImdbTitle[]; error?: string };
  if (!res.ok) throw new Error(json.error ?? `Similar titles failed (${res.status})`);
  return json.titles ?? [];
}

export async function getOriginalLanguage(imdbId: string, signal?: AbortSignal) {
  const title = await getTitle(imdbId, signal);
  return origLang(title);
}
