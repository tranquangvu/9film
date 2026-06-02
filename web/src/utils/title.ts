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

function pickBackdrop(title: ImdbTitle): string {
  const edges = title.images?.edges ?? [];
  const landscape = edges.find((e) => {
    const node = e?.node;
    return !!node?.url && (node.width ?? 0) > (node.height ?? 0);
  });
  return landscape?.node?.url ?? edges[0]?.node?.url ?? title.primaryImage?.url ?? '';
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

function imageArea(title: ImdbTitle): number {
  return (title.primaryImage?.width ?? 0) * (title.primaryImage?.height ?? 0);
}

// Picks the strongest hero candidates: those in a marquee genre with a primary
// image, ranked by image resolution first (sharp banners) then user rating.
export function heroTitles(titles: ImdbTitle[], limit = 8): Movie[] {
  const candidates = titles.filter((t) => {
    if (!t.id || !t.primaryImage?.url) return false;
    return (t.genres?.genres ?? []).some((g) => g.text && HERO_GENRES.has(g.text));
  });

  candidates.sort((a, b) => {
    const byArea = imageArea(b) - imageArea(a);
    if (byArea !== 0) return byArea;
    return (b.ratingsSummary?.aggregateRating ?? 0) - (a.ratingsSummary?.aggregateRating ?? 0);
  });

  return toMovies(candidates.slice(0, limit));
}
