import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSubtitlePrefs, putSubtitlePref, type SubtitlePrefItem } from '@/services/user';
import { useAuth } from '@/context/auth-context';

const SUBTITLE_PREFS_KEY = ['subtitle-prefs'] as const;

export function useSubtitlePrefsQuery() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: SUBTITLE_PREFS_KEY,
    queryFn: getSubtitlePrefs,
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });
}

// Saves a per-title subtitle selection. Patches the cache directly (one row per
// imdbId) rather than refetching.
export function useSaveSubtitlePref() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: SubtitlePrefItem) => putSubtitlePref(item),
    onSuccess: (saved) => {
      qc.setQueryData<SubtitlePrefItem[]>(SUBTITLE_PREFS_KEY, (old = []) => {
        const next = old.filter((p) => p.imdbId !== saved.imdbId);
        return [saved, ...next];
      });
    },
  });
}
