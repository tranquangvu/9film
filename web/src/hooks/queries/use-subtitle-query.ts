import { useMutation, useQueryClient } from '@tanstack/react-query';
import { putSubtitle, type SubtitleItem } from '@/services/user';
import type { Title, TitleProgress } from '@/utils/title';

// Saves the subtitle picked for one episode. The saved preference rides along in
// the title detail response (on the matching progress entry), so we patch that
// cached title directly rather than keeping a separate query.
export function useSaveSubtitle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: SubtitleItem) => putSubtitle(item),
    onSuccess: (saved) => {
      qc.setQueriesData<Title>({ queryKey: ['title'] }, (old) => {
        if (!old || old.id !== saved.imdbId) return old;
        const subtitlePref = { fileId: saved.fileId, language: saved.language };
        const progress = [...(old.progress ?? [])];
        const idx = progress.findIndex((p) => p.season === saved.season && p.episode === saved.episode);
        if (idx >= 0) {
          progress[idx] = { ...progress[idx], subtitlePref };
        } else {
          // No resume point for this episode yet — add a subtitle-only entry.
          const entry: TitleProgress = {
            season: saved.season,
            episode: saved.episode,
            positionSeconds: 0,
            durationSeconds: 0,
            subtitlePref,
          };
          progress.push(entry);
        }
        return { ...old, progress };
      });
    },
  });
}
