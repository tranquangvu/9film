import { useQuery } from '@tanstack/react-query';
import { getSubtitles } from '@/services/subtitle';
import type { EmbedParams } from '@/utils/stream';

// Searches for subtitles in the user's preferred subtitle language (from
// settings) — not the title's original language — so a learner always gets
// subtitles in the language they chose.
export function useSubtitlesQuery(
  params: EmbedParams | null,
  imdbId: string | null,
  language: string,
) {
  return useQuery({
    queryKey: [
      'subtitles',
      imdbId,
      params?.mediaType,
      params?.season ?? null,
      params?.episode ?? null,
      language,
    ],
    queryFn: ({ signal }) =>
      getSubtitles({ params: params!, imdbId: imdbId!, languages: language }, signal),
    enabled: !!(params && imdbId && language),
    staleTime: Infinity,
  });
}
