import type { CastMember, Title } from '@/types';
import type { MediaType } from './stream';

export interface TitleImage {
  url: string;
  width?: number;
  height?: number;
}

// A resume point embedded in a title's detail (movies: one row with season/
// episode 0; series: one per watched episode), carrying the subtitle chosen for
// that episode. Title-scoped, so no imdbId.
export interface TitleProgress {
  season: number;
  episode: number;
  positionSeconds: number;
  durationSeconds: number;
  // The subtitle the user picked for this episode (absent when none is set).
  subtitlePref?: { fileId: number; language: string };
  updatedAt?: string;
}

// Flattened, client-ready title — the exact shape the backend now returns (it
// does the GraphQL flattening server-side). `Title` remains the render model;
// `toTitle` adapts a TitleDetail into it.
export interface TitleDetail {
  id: string;
  title: string;
  originalTitle?: string;
  description: string;
  poster: string;
  backdrop: string;
  rating: number;
  voteCount?: number;
  year: string;
  endYear?: string;
  releaseDate?: string;
  duration: number; // minutes
  genres: string[];
  cast?: CastMember[];
  director?: string;
  language?: string;
  languageCode?: string;
  country?: string;
  type: Title['type'];
  totalSeasons?: number;
  totalEpisodes?: number;
  // Gallery images with dimensions — used to rank hero backdrops by resolution.
  images?: TitleImage[];
  // Set by the backend when the signed-in user has favorited this title.
  isFavorite?: boolean;
  // The signed-in user's resume points for this title (absent when anonymous),
  // each carrying the subtitle chosen for that episode.
  progress?: TitleProgress[];
}

export interface BrowseResult {
  titles: TitleDetail[];
  hasNextPage: boolean;
  endCursor?: string;
}

export function normId(id: string): string {
  return id.startsWith('tt') ? id : `tt${id}`;
}

export function embedParams(title: TitleDetail, mediaId: string) {
  const mediaType: MediaType = title.type === 'series' ? 'tv' : 'movie';
  return { mediaType, mediaId: title.id || normId(mediaId) };
}

// The largest landscape image for a title — what the hero banner displays.
// Returns null when the title has no usable wide image.
export function bestBackdrop(title: TitleDetail): TitleImage | null {
  let best: TitleImage | null = null;
  for (const n of title.images ?? []) {
    const w = n.width ?? 0;
    const h = n.height ?? 0;
    if (!n.url || w <= h) continue; // landscape only
    if (!best || w * h > (best.width ?? 0) * (best.height ?? 0)) best = n;
  }
  return best;
}

export function toTitle(title: TitleDetail): Title {
  const type = title.type;
  return {
    id: title.id ?? '',
    title: title.title ?? '',
    description: title.description ?? '',
    poster: title.poster ?? '',
    backdrop: title.backdrop || title.poster || '',
    rating: title.rating ?? 0,
    year: title.year ?? '',
    duration: title.duration ?? 0,
    genres: title.genres ?? [],
    cast: title.cast ?? [],
    director: title.director ?? '',
    language: title.language ?? '',
    country: title.country ?? '',
    type,
    totalSeasons: type === 'series' ? title.totalSeasons || undefined : undefined,
    totalEpisodes: type === 'series' ? title.totalEpisodes || undefined : undefined,
    isFavorite: title.isFavorite ?? false,
  };
}

export function toTitles(titles: TitleDetail[]): Title[] {
  return titles.filter((t) => t.id).map(toTitle);
}

export function filterTitles(titles: TitleDetail[], type?: Title['type']): Title[] {
  const result = toTitles(titles);
  if (!type) return result;
  return result.filter((m) => m.type === type);
}

export function topRated(titles: TitleDetail[], limit = 10): Title[] {
  return [...toTitles(titles)].sort((a, b) => b.rating - a.rating).slice(0, limit);
}

const HERO_GENRES = new Set(['Action', 'Adventure', 'Sci-Fi', 'Thriller', 'Crime', 'Animation']);

// True when the title is tagged with at least one marquee genre — the shared
// gate for the hero banner and the Top 10 row.
export function matchesHeroGenres(title: TitleDetail): boolean {
  return (title.genres ?? []).some((g) => HERO_GENRES.has(g));
}

// A hero banner needs a wide, sharp backdrop — smaller images look soft when
// stretched full-bleed. Titles whose best landscape image is narrower than this
// are skipped.
const MIN_BACKDROP_WIDTH = 1024;

// Picks the strongest hero candidates: marquee-genre titles that have a
// good-quality landscape backdrop, ranked by user rating (tie-broken by backdrop
// resolution so the sharper banner wins).
export function heroTitles(titles: TitleDetail[], limit = 8): Title[] {
  const candidates = titles
    .map((t) => ({ title: t, backdrop: bestBackdrop(t) }))
    .filter(
      ({ title, backdrop }) =>
        title.id && matchesHeroGenres(title) && backdrop && (backdrop.width ?? 0) >= MIN_BACKDROP_WIDTH,
    );

  candidates.sort((a, b) => {
    const byRating = (b.title.rating ?? 0) - (a.title.rating ?? 0);
    if (byRating !== 0) return byRating;
    return (b.backdrop?.width ?? 0) - (a.backdrop?.width ?? 0);
  });

  return toTitles(candidates.slice(0, limit).map((c) => c.title));
}
