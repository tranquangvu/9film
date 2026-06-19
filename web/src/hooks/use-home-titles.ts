import { heroTitles, matchesHeroGenres, toMovies, type ImdbTitle } from '@/utils/title';
import type { Movie } from '@/types';
import { useBrowseTitleQuery } from './queries/use-browse-title-query';
import { useContinueWatching } from './queries/use-progress-query';

const HERO_LIMIT = 8;
const TOP_TEN_LIMIT = 10;

// A mixed movie+series feed sorted by popularity, used to source the hero banner
// and the Top 10 row. BrowseTitles applies the shared release cutoff, so every
// title here is old enough to have a stream — unlike IMDb `trendingTitles`, which
// is dominated by just/unreleased titles. Kept larger than the Popular rows so
// there's a healthy remainder for hero + Top 10 after the rows are excluded
// (see selectHeroAndTop10).
const POPULAR_LIMIT = 100;

export function usePopularTitles() {
  return useBrowseTitleQuery({ sort: 'popular', first: POPULAR_LIMIT }, (data) => data.titles);
}

export function usePopularMovieTitles() {
  return useBrowseTitleQuery({ type: 'movie', sort: 'popular', first: 20 }, (data) => toMovies(data.titles));
}

export function usePopularTVSeriesTitles() {
  return useBrowseTitleQuery({ type: 'tv', sort: 'popular', first: 20 }, (data) => toMovies(data.titles));
}

// Continue Watching row. The backend returns one deduped row per title with the
// detail embedded, so this maps straight to cards without per-title lookups.
export function useResumeTitles() {
  const { movies, isLoading, isError } = useContinueWatching();
  return { data: movies, loading: isLoading, isError };
}

// Carve the hero + Top 10 out of the popular feed, excluding every title already
// shown in the Popular rows so the sections never 100% duplicate each other.
// Dedup is by IMDb id (Movie.id === ImdbTitle.id).
export function selectHeroAndTop10({
  candidates,
  popularRows,
}: {
  candidates: ImdbTitle[];
  popularRows: Movie[];
}): { hero: Movie[]; top10: Movie[] } {
  const excluded = new Set(popularRows.map((m) => m.id));
  const rest = candidates.filter((t) => t.id && !excluded.has(t.id));
  return {
    hero: heroTitles(rest, HERO_LIMIT),
    top10: toMovies(rest.filter(matchesHeroGenres)).slice(0, TOP_TEN_LIMIT),
  };
}
