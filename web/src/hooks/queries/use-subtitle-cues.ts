import { useQuery } from '@tanstack/react-query';
import { apiFetchBlob } from '@/lib/api-fetch';
import { parseVtt, type Cue } from '@/utils/vtt';

// Fetches the VTT for a chosen subtitle (authed, so the user's own provider key
// is used) and parses it into timed cues. Subtitle files never change, so cache
// forever.
export function useSubtitleCues(id: string | null) {
  return useQuery<Cue[]>({
    queryKey: ['subtitle-cues', id],
    queryFn: async ({ signal }) => {
      const blob = await apiFetchBlob(`/api/subtitle/download?id=${encodeURIComponent(id!)}`, signal);
      return parseVtt(await blob.text());
    },
    enabled: !!id,
    staleTime: Infinity,
  });
}
