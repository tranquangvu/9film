import { useMutation, useQueryClient } from '@tanstack/react-query';
import { putSubtitle, type SubtitleItem } from '@/services/user';
import type { Title } from '@/utils/title';

// Saves a per-title subtitle selection. The saved preference rides along in the
// title detail response, so we patch that cached title directly rather than
// keeping a separate query.
export function useSaveSubtitle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: SubtitleItem) => putSubtitle(item),
    onSuccess: (saved) => {
      qc.setQueriesData<Title>({ queryKey: ['title'] }, (old) => {
        if (!old || old.id !== saved.imdbId) return old;
        return { ...old, subtitlePref: { fileId: saved.fileId, language: saved.language } };
      });
    },
  });
}
