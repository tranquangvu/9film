import type { CastMember, Movie } from '@/types';
import type { MediaType } from './stream';

export interface ImdbTitle {
  id?: string;
  titleText?: { text?: string };
  originalTitleText?: { text?: string };
  titleType?: { id?: string; text?: string; canHaveEpisodes?: boolean };
  releaseYear?: { year?: number; endYear?: number | null };
  primaryImage?: { url?: string; width?: number; height?: number };
  plot?: { plotText?: { plainText?: string } };
  ratingsSummary?: { aggregateRating?: number; voteCount?: number };
  runtime?: { seconds?: number };
  genres?: { genres?: Array<{ text?: string }> };
  countriesOfOrigin?: { countries?: Array<{ text?: string }> };
  spokenLanguages?: {
    spokenLanguages?: Array<{ id?: string; text?: string }>;
  };
  principalCredits?: Array<{
    category?: { text?: string };
    credits?: Array<{
      name?: {
        id?: string;
        nameText?: { text?: string };
        primaryImage?: { url?: string };
      };
      characters?: Array<{ name?: string }>;
    }>;
  }>;
  images?: {
    edges?: Array<{ node?: { url?: string; width?: number; height?: number } }>;
  };
  episodes?: {
    episodes?: { total?: number };
    seasons?: Array<{ number?: number }>;
  };
  // Set by the backend (not IMDb) when the signed-in user has favorited this
  // title — seeds the card's heart state without a separate /api/me/favorites call.
  isFavorite?: boolean;
}

export interface OriginalLanguage {
  code: string;
  label: string;
}

export interface BrowseResult {
  titles: ImdbTitle[];
  hasNextPage: boolean;
  endCursor?: string;
}

const TV_TYPES = new Set(['tvSeries', 'tvMiniSeries', 'tvSpecial', 'tvMovie']);

const LANG_MAP: Record<string, string> = {
  cn: 'zh-cn',
  tw: 'zh-tw',
  pb: 'pt-br',
  pt: 'pt-pt',
};

export function normId(id: string): string {
  return id.startsWith('tt') ? id : `tt${id}`;
}

export function embedParams(title: ImdbTitle, mediaId: string) {
  const typeId = title.titleType?.id;
  const mediaType: MediaType = typeId && TV_TYPES.has(typeId) ? 'tv' : 'movie';
  return { mediaType, mediaId: title.id ?? normId(mediaId) };
}

export function origLang(title: ImdbTitle): OriginalLanguage {
  const primary = title.spokenLanguages?.spokenLanguages?.[0];
  if (!primary?.id) throw new Error('No original language found on IMDb');

  const raw = primary.id.trim().toLowerCase();
  const code = LANG_MAP[raw] ?? raw.split('-')[0] ?? raw;
  return { code, label: primary.text ?? code.toUpperCase() };
}

function mediaType(title: ImdbTitle): Movie['type'] {
  const id = title.titleType?.id;
  if (id && TV_TYPES.has(id)) return 'series';
  return 'movie';
}

// The largest landscape image for a title — what the hero banner displays.
// Returns null when the title has no usable wide image.
export function bestBackdrop(
  title: ImdbTitle,
): { url: string; width: number; height: number } | null {
  let best: { url: string; width: number; height: number } | null = null;
  for (const e of title.images?.edges ?? []) {
    const n = e?.node;
    const w = n?.width ?? 0;
    const h = n?.height ?? 0;
    if (!n?.url || w <= h) continue; // landscape only
    if (!best || w * h > best.width * best.height) best = { url: n.url, width: w, height: h };
  }
  return best;
}

function pickBackdrop(title: ImdbTitle): string {
  const edges = title.images?.edges ?? [];
  return bestBackdrop(title)?.url ?? edges[0]?.node?.url ?? title.primaryImage?.url ?? '';
}

function mapCast(title: ImdbTitle): CastMember[] {
  const stars = title.principalCredits?.find((g) => g.category?.text === 'Stars');
  if (!stars?.credits) return [];

  return stars.credits.map((credit) => ({
    id: credit.name?.id ?? credit.name?.nameText?.text ?? '',
    name: credit.name?.nameText?.text ?? '',
    character: credit.characters?.[0]?.name ?? '',
    photo: credit.name?.primaryImage?.url ?? '',
  }));
}

function pickDirector(title: ImdbTitle): string {
  const group = title.principalCredits?.find((g) => g.category?.text === 'Director');
  return group?.credits?.[0]?.name?.nameText?.text ?? '';
}

export function toMovie(title: ImdbTitle): Movie {
  const poster = title.primaryImage?.url ?? '';
  const year = title.releaseYear?.year ? String(title.releaseYear.year) : '';
  const duration = title.runtime?.seconds ? Math.round(title.runtime.seconds / 60) : 0;
  const type = mediaType(title);

  return {
    id: title.id ?? '',
    title: title.titleText?.text ?? '',
    description: title.plot?.plotText?.plainText ?? '',
    poster,
    backdrop: pickBackdrop(title) || poster,
    rating: title.ratingsSummary?.aggregateRating ?? 0,
    year,
    duration,
    genres: title.genres?.genres?.map((g) => g.text).filter(Boolean) as string[] ?? [],
    cast: mapCast(title),
    director: pickDirector(title),
    language: title.spokenLanguages?.spokenLanguages?.[0]?.text ?? '',
    country: title.countriesOfOrigin?.countries?.[0]?.text ?? '',
    type,
    totalSeasons: type === 'series' ? title.episodes?.seasons?.length || undefined : undefined,
    totalEpisodes: type === 'series' ? title.episodes?.episodes?.total || undefined : undefined,
    isFavorite: title.isFavorite ?? false,
  };
}

export function toMovies(titles: ImdbTitle[]): Movie[] {
  return titles.filter((t) => t.id).map(toMovie);
}

export function filterMovies(titles: ImdbTitle[], type?: Movie['type']): Movie[] {
  const movies = toMovies(titles);
  if (!type) return movies;
  return movies.filter((m) => m.type === type);
}

export function topRated(titles: ImdbTitle[], limit = 10): Movie[] {
  return [...toMovies(titles)].sort((a, b) => b.rating - a.rating).slice(0, limit);
}

const HERO_GENRES = new Set(['Action', 'Adventure', 'Sci-Fi', 'Thriller', 'Crime', 'Animation']);

// True when the title is tagged with at least one marquee genre — the shared
// gate for the hero banner and the Top 10 row.
export function matchesHeroGenres(title: ImdbTitle): boolean {
  return (title.genres?.genres ?? []).some((g) => g.text && HERO_GENRES.has(g.text));
}

// A hero banner needs a wide, sharp backdrop — smaller images look soft when
// stretched full-bleed. Titles whose best landscape image is narrower than this
// are skipped.
const MIN_BACKDROP_WIDTH = 1024;

// Picks the strongest hero candidates: marquee-genre titles that have a
// good-quality landscape backdrop, ranked by user rating (tie-broken by backdrop
// resolution so the sharper banner wins).
export function heroTitles(titles: ImdbTitle[], limit = 8): Movie[] {
  const candidates = titles
    .map((t) => ({ title: t, backdrop: bestBackdrop(t) }))
    .filter(
      ({ title, backdrop }) =>
        title.id && matchesHeroGenres(title) && backdrop && backdrop.width >= MIN_BACKDROP_WIDTH,
    );

  candidates.sort((a, b) => {
    const byRating =
      (b.title.ratingsSummary?.aggregateRating ?? 0) - (a.title.ratingsSummary?.aggregateRating ?? 0);
    if (byRating !== 0) return byRating;
    return (b.backdrop?.width ?? 0) - (a.backdrop?.width ?? 0);
  });

  return toMovies(candidates.slice(0, limit).map((c) => c.title));
}
