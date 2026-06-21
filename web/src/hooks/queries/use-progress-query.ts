import { useMemo } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getContinueWatching, putProgress, type ProgressItem } from '@/services/user';
import { useAuth } from '@/context/auth-context';
import { useTitleQuery } from './use-title-query';
import { toTitle, type TitleDetail, type TitleProgress } from '@/utils/title';
import type { Title } from '@/types';

const CONTINUE_PAGE = 20;

// Paginated Continue Watching list (one row per title), infinite-scrolled.
// Backed by a dedicated endpoint so it doesn't pull every per-episode row.
export function useContinueWatchingInfinite() {
  const { isAuthenticated } = useAuth();
  return useInfiniteQuery({
    queryKey: ['continue-watching'],
    queryFn: ({ pageParam }) => getContinueWatching(pageParam, CONTINUE_PAGE),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.hasMore ? last.nextOffset : undefined),
    enabled: isAuthenticated,
    staleTime: 30 * 1000,
  });
}

// Continue Watching as ready-to-render Title cards. The backend embeds each
// title's detail, so we map straight to Titles + resume progress here — no
// per-title /api/title/:id lookup. Used by the home row and the My List grid.
export function useContinueWatching() {
  const q = useContinueWatchingInfinite();
  const titles = useMemo<Title[]>(() => {
    const items = q.data?.pages.flatMap((p) => p.items) ?? [];
    return items.flatMap((it) => {
      if (!it.title) return [];
      return [{
        ...toTitle(it.title),
        progress: progressPercent(it),
        // season > 0 only for series; movies stay undefined.
        resumeSeason: it.season > 0 ? it.season : undefined,
        resumeEpisode: it.season > 0 ? it.episode : undefined,
      }];
    });
  }, [q.data]);
  return { ...q, titles };
}

// Per-title progress now rides along in the title detail response, so these
// hooks read it straight from the (cached) title query — no separate fetch.
function useProgressRows(imdbId: string): TitleProgress[] {
  const { data } = useTitleQuery(imdbId);
  return data?.progress ?? [];
}

// Set of "season:episode" keys that have saved watch progress for a title.
// Drives the "watched" highlight in episode selectors.
export function useWatchedEpisodes(imdbId: string): Set<string> {
  const progress = useProgressRows(imdbId);
  return useMemo(() => {
    const set = new Set<string>();
    for (const p of progress) {
      if (p.season > 0) set.add(`${p.season}:${p.episode}`);
    }
    return set;
  }, [progress]);
}

// The most-recently-played episode for a title (progress is ordered newest-first),
// i.e. the one the user would resume — drives the "now playing" badge.
export function useCurrentEpisode(imdbId: string): { season: number; episode: number } | null {
  const progress = useProgressRows(imdbId);
  return useMemo(() => {
    const p = progress.find((p) => p.season > 0);
    return p ? { season: p.season, episode: p.episode } : null;
  }, [progress]);
}

// The saved resume point for a movie (movies store season/episode as 0).
// Returns null when the user has never played it. Drives the watch-info block
// on the detail page, mirroring the per-episode markers used for series.
export function useTitleProgress(imdbId: string): TitleProgress | null {
  const progress = useProgressRows(imdbId);
  return useMemo(() => progress.find((p) => p.season === 0) ?? null, [progress]);
}

// Percentage watched, clamped 0–100.
export function progressPercent(p: Pick<ProgressItem, 'positionSeconds' | 'durationSeconds'>): number {
  if (!p.durationSeconds) return 0;
  return Math.min(100, Math.max(0, Math.round((p.positionSeconds / p.durationSeconds) * 100)));
}

// Saves a resume point. Patches the matching title's cached `progress` array
// directly (rather than invalidating) so frequent in-player saves don't trigger
// refetch churn, while the detail page's watched markers stay live.
export function useSaveProgress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: ProgressItem) => putProgress(item),
    onSuccess: (saved) => {
      const entry: TitleProgress = {
        season: saved.season,
        episode: saved.episode,
        positionSeconds: saved.positionSeconds,
        durationSeconds: saved.durationSeconds,
        updatedAt: saved.updatedAt ?? new Date().toISOString(),
      };
      qc.setQueriesData<TitleDetail>({ queryKey: ['title'] }, (old) => {
        if (!old || old.id !== saved.imdbId) return old;
        // Replace this episode's row (movies use season/episode 0) and move it to
        // the front so progress stays ordered most-recent-first.
        const rest = (old.progress ?? []).filter(
          (p) => !(p.season === saved.season && p.episode === saved.episode),
        );
        return { ...old, progress: [entry, ...rest] };
      });
    },
  });
}
