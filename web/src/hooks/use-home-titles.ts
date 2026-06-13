import { heroTitles, matchesHeroGenres, toMovies, type ImdbTitle } from '@/utils/title';
import type { Movie } from '@/types';
import { useBrowseTitleQuery } from './queries/use-browse-title-query';
import { useTitlesQuery } from './queries/use-titles-query';
import { useProgressQuery, progressPercent } from './queries/use-progress-query';

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
  const { data: progressItems } = useProgressQuery();
  const items = progressItems ?? [];
  // Progress is per-episode, so a series has several rows. Collapse to one card
  // per title, keeping the most-recent row (the list is ordered newest-first).
  const seen = new Set<string>();
  const latestPerTitle = items.filter((p) => {
    if (seen.has(p.imdbId)) return false;
    seen.add(p.imdbId);
    return true;
  });
  return useTitlesQuery(latestPerTitle.map((p) => p.imdbId), {
    select: (movies) =>
      movies.map((movie) => {
        const p = latestPerTitle.find((x) => x.imdbId === movie.id);
        if (!p) return movie;
        return {
          ...movie,
          progress: progressPercent(p),
          // season > 0 only for series; movies stay undefined.
          resumeSeason: p.season > 0 ? p.season : undefined,
          resumeEpisode: p.season > 0 ? p.episode : undefined,
        };
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
    // Top 10 shares the hero's marquee-genre gate, keeping popularity order.
    top10: toMovies(rest.filter(matchesHeroGenres)).slice(0, TOP_TEN_LIMIT),
  };
}
