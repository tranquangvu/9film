import { continueWatchingIds } from '@/data/user';
import { heroTitles, toMovies } from '@/utils/title';
import { useBrowseTitleQuery } from './queries/use-browse-title-query';
import { useTrendingTitlesQuery } from './queries/use-trending-titles-query';
import { useTitlesQuery } from './queries/use-titles-query';

const HERO_LIMIT = 8;
const TOP_TEN_LIMIT = 10;

// Trending pool, narrowed to the strongest hero candidates inside the hook.
export function useHeroTitles() {
  return useTrendingTitlesQuery(30, (titles) => heroTitles(titles, HERO_LIMIT));
}

export function useTop10Titles() {
  return useTrendingTitlesQuery(10, (titles) => toMovies(titles).slice(0, TOP_TEN_LIMIT));
}

export function usePopularMovieTitles() {
  return useBrowseTitleQuery({ type: 'movie', sort: 'popular', first: 20 }, (data) => toMovies(data.titles));
}

export function usePopularTVSeriesTitles() {
  return useBrowseTitleQuery({ type: 'tvseries', sort: 'popular', first: 20 }, (data) => toMovies(data.titles));
}

export function useResumeTitles() {
  return useTitlesQuery(continueWatchingIds.map((item) => item.id), {
    select: (movies) => movies.map((movie) => {
      const progress = continueWatchingIds.find((item) => item.id === movie.id)?.progress;
      return progress != null ? { ...movie, progress } : movie;
    }),
  });
}
