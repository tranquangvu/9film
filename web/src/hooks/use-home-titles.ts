import { continueWatchingIds } from '@/data/user';
import { heroTitles, toMovies, type ImdbTitle } from '@/utils/title';
import type { Movie } from '@/types';
import { useBrowseTitleQuery } from './queries/use-browse-title-query';
import { useTitlesQuery } from './queries/use-titles-query';

const HERO_LIMIT = 8;
const TOP_TEN_LIMIT = 10;

// A mixed movie+series pool sorted by popularity. BrowseTitles applies the
// shared release cutoff, so every title here is old enough to have a stream —
// unlike IMDb `trendingTitles`, which is dominated by just/unreleased titles.
// Kept larger than the Popular rows so there's a healthy remainder for hero +
// Top 10 after the rows are excluded (see partitionHomeTitles).
const POOL_SIZE = 60;

export function usePopularPoolTitles() {
  return useBrowseTitleQuery({ sort: 'popular', first: POOL_SIZE }, (data) => data.titles);
}

export function usePopularMovieTitles() {
  return useBrowseTitleQuery({ type: 'movie', sort: 'popular', first: 20 }, (data) => toMovies(data.titles));
}

export function usePopularTVSeriesTitles() {
  return useBrowseTitleQuery({ type: 'tv', sort: 'popular', first: 20 }, (data) => toMovies(data.titles));
}

export function useResumeTitles() {
  return useTitlesQuery(continueWatchingIds.map((item) => item.id), {
    select: (movies) => movies.map((movie) => {
      const progress = continueWatchingIds.find((item) => item.id === movie.id)?.progress;
      return progress != null ? { ...movie, progress } : movie;
    }),
  });
}

// Carve the hero + Top 10 out of the popular pool, excluding every title already
// shown in the Popular rows so the sections never 100% duplicate each other.
// Dedup is by IMDb id (Movie.id === ImdbTitle.id).
export function partitionHomeTitles(
  pool: ImdbTitle[],
  popularRows: Movie[],
): { hero: Movie[]; top10: Movie[] } {
  const excluded = new Set(popularRows.map((m) => m.id));
  const rest = pool.filter((t) => t.id && !excluded.has(t.id));
  return {
    hero: heroTitles(rest, HERO_LIMIT),
    top10: toMovies(rest).slice(0, TOP_TEN_LIMIT),
  };
}
