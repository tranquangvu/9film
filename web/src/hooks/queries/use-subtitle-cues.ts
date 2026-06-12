import { useQuery } from '@tanstack/react-query';
import { parseVtt, type Cue } from '@/utils/vtt';

// Fetches the VTT for a chosen subtitle file and parses it into timed cues.
// Shares the file with the native <track>, so the browser cache means no extra
// download when both render. Subtitle files never change, so cache forever.
export function useSubtitleCues(fileId: number | null) {
  return useQuery<Cue[]>({
    queryKey: ['subtitle-cues', fileId],
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/subtitle/download?file_id=${fileId}`, { signal });
      if (!res.ok) throw new Error(`Failed to load subtitles (${res.status})`);
      return parseVtt(await res.text());
    },
    enabled: fileId !== null,
    staleTime: Infinity,
  });
}
