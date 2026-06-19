import type { BrowseResult, Title } from '@/utils/title';
import { normId, origLang } from '@/utils/title';
import { apiFetch, ApiError } from '@/lib/api-fetch';

/** Thrown when an IMDb id doesn't resolve to a title (unknown or malformed). */
export class TitleNotFoundError extends Error {
  constructor(id: string) {
    super(`Title not found: ${id}`);
    this.name = 'TitleNotFoundError';
  }
}

// These endpoints are public, but we still go through apiFetch so the bearer
// token rides along when signed in — the backend uses it to stamp each title's
// `isFavorite` flag.
export async function getTitle(imdbId: string, signal?: AbortSignal): Promise<Title> {
  const id = encodeURIComponent(normId(imdbId));
  try {
    const json = await apiFetch<Title>(`/api/title/${id}`, { signal });
    if (!json.id) throw new TitleNotFoundError(imdbId);
    return json;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) throw new TitleNotFoundError(imdbId);
    throw err;
  }
}

export async function searchTitles(q: string, limit = 20, signal?: AbortSignal): Promise<Title[]> {
  const params = new URLSearchParams({ q, limit: String(limit) });
  const json = await apiFetch<{ titles?: Title[] }>(`/api/title/search?${params}`, { signal });
  return json.titles ?? [];
}

export async function getTrendingTitles(limit = 10, signal?: AbortSignal): Promise<Title[]> {
  const json = await apiFetch<{ titles?: Title[] }>(`/api/title/trending?limit=${limit}`, { signal });
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

  const json = await apiFetch<BrowseResult>(`/api/title/browse?${params}`, { signal });
  return { titles: json.titles ?? [], hasNextPage: json.hasNextPage ?? false, endCursor: json.endCursor };
}

export async function getSimilarTitles(imdbId: string, limit = 6, signal?: AbortSignal): Promise<Title[]> {
  const id = encodeURIComponent(normId(imdbId));
  const json = await apiFetch<{ titles?: Title[] }>(`/api/title/${id}/similar?limit=${limit}`, { signal });
  return json.titles ?? [];
}

export async function getOriginalLanguage(imdbId: string, signal?: AbortSignal) {
  const title = await getTitle(imdbId, signal);
  return origLang(title);
}
