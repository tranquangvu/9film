import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSubtitles, putSubtitle, type SubtitleItem } from '@/services/user';
import { useAuth } from '@/context/auth-context';

const SUBTITLES_KEY = ['subtitles'] as const;

export function useSavedSubtitlesQuery() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: SUBTITLES_KEY,
    queryFn: getSubtitles,
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });
}

// Saves a per-title subtitle selection. Patches the cache directly (one row per
// imdbId) rather than refetching.
export function useSaveSubtitle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: SubtitleItem) => putSubtitle(item),
    onSuccess: (saved) => {
      qc.setQueryData<SubtitleItem[]>(SUBTITLES_KEY, (old = []) => {
        const next = old.filter((p) => p.imdbId !== saved.imdbId);
        return [saved, ...next];
      });
    },
  });
}
