import { useQuery } from '@tanstack/react-query';
import { apiFetchBlob } from '@/lib/api-fetch';
import { parseVtt, type Cue } from '@/utils/vtt';

// Fetches the VTT for a chosen subtitle file (authed, so the user's own
// OpenSubtitles key is used) and parses it into timed cues. Subtitle files never
// change, so cache forever.
export function useSubtitleCues(fileId: number | null) {
  return useQuery<Cue[]>({
    queryKey: ['subtitle-cues', fileId],
    queryFn: async ({ signal }) => {
      const blob = await apiFetchBlob(`/api/subtitle/download?file_id=${fileId}`, signal);
      return parseVtt(await blob.text());
    },
    enabled: fileId !== null,
    staleTime: Infinity,
  });
}
