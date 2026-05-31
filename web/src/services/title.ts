import type { BrowseResult, ImdbTitle } from '@/utils/title';
import { normId, origLang } from '@/utils/title';

export async function fetchTitle(imdbId: string, signal?: AbortSignal): Promise<ImdbTitle> {
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

export async function fetchPopular(limit = 20, signal?: AbortSignal): Promise<ImdbTitle[]> {
  const res = await fetch(`/api/title/popular?limit=${limit}`, { signal });
  const json = (await res.json()) as { titles?: ImdbTitle[]; error?: string };
  if (!res.ok) throw new Error(json.error ?? `Popular titles failed (${res.status})`);
  return json.titles ?? [];
}

export async function fetchTrending(limit = 20, signal?: AbortSignal): Promise<ImdbTitle[]> {
  const res = await fetch(`/api/title/trending?limit=${limit}`, { signal });
  const json = (await res.json()) as { titles?: ImdbTitle[]; error?: string };
  if (!res.ok) throw new Error(json.error ?? `Trending titles failed (${res.status})`);
  return json.titles ?? [];
}

export async function fetchSearch(q: string, limit = 20, signal?: AbortSignal): Promise<ImdbTitle[]> {
  const params = new URLSearchParams({ q, limit: String(limit) });
  const res = await fetch(`/api/title/search?${params}`, { signal });
  const json = (await res.json()) as { titles?: ImdbTitle[]; error?: string };
  if (!res.ok) throw new Error(json.error ?? `Search failed (${res.status})`);
  return json.titles ?? [];
}

export async function fetchBrowse(
  opts: { type?: string; genre?: string; first?: number; after?: string; minRating?: number },
  signal?: AbortSignal,
): Promise<BrowseResult> {
  const params = new URLSearchParams();
  if (opts.type) params.set('type', opts.type);
  if (opts.genre) params.set('genre', opts.genre);
  if (opts.first) params.set('first', String(opts.first));
  if (opts.after) params.set('after', opts.after);
  if (opts.minRating != null) params.set('minRating', String(opts.minRating));

  const res = await fetch(`/api/title/browse?${params}`, { signal });
  const json = (await res.json()) as BrowseResult & { error?: string };
  if (!res.ok) throw new Error(json.error ?? `Browse failed (${res.status})`);
  return { titles: json.titles ?? [], hasNextPage: json.hasNextPage ?? false, endCursor: json.endCursor };
}

export async function fetchSimilar(imdbId: string, limit = 6, signal?: AbortSignal): Promise<ImdbTitle[]> {
  const id = encodeURIComponent(normId(imdbId));
  const res = await fetch(`/api/title/${id}/similar?limit=${limit}`, { signal });
  const json = (await res.json()) as { titles?: ImdbTitle[]; error?: string };
  if (!res.ok) throw new Error(json.error ?? `Similar titles failed (${res.status})`);
  return json.titles ?? [];
}

export async function fetchOriginalLanguage(imdbId: string, signal?: AbortSignal) {
  const title = await fetchTitle(imdbId, signal);
  return origLang(title);
}
