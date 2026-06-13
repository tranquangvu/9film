import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getProgress, putProgress, type ProgressItem } from '@/services/user';
import { useAuth } from '@/context/auth-context';

const PROGRESS_KEY = ['progress'] as const;

// Set of "season:episode" keys that have saved watch progress for a title.
// Drives the "watched" highlight in episode selectors.
export function useWatchedEpisodes(imdbId: string): Set<string> {
  const { data } = useProgressQuery();
  return useMemo(() => {
    const set = new Set<string>();
    for (const p of data ?? []) {
      if (p.imdbId === imdbId && p.season > 0) set.add(`${p.season}:${p.episode}`);
    }
    return set;
  }, [data, imdbId]);
}

export function useProgressQuery() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: PROGRESS_KEY,
    queryFn: getProgress,
    enabled: isAuthenticated,
    staleTime: 30 * 1000,
  });
}

// Percentage watched, clamped 0–100.
export function progressPercent(p: Pick<ProgressItem, 'positionSeconds' | 'durationSeconds'>): number {
  if (!p.durationSeconds) return 0;
  return Math.min(100, Math.max(0, Math.round((p.positionSeconds / p.durationSeconds) * 100)));
}

// Saves a resume point. Patches the progress cache directly (rather than
// invalidating) so frequent in-player saves don't trigger refetch churn.
export function useSaveProgress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: ProgressItem) => putProgress(item),
    onSuccess: (saved) => {
      qc.setQueryData<ProgressItem[]>(PROGRESS_KEY, (old = []) => {
        // Replace only this episode's row (movies use season/episode 0) and move
        // it to the front so the list stays ordered most-recent-first.
        const next = old.filter(
          (p) => !(p.imdbId === saved.imdbId && p.season === saved.season && p.episode === saved.episode),
        );
        return [{ ...saved, updatedAt: saved.updatedAt ?? new Date().toISOString() }, ...next];
      });
    },
  });
}
