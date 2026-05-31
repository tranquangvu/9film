import { useQuery } from '@tanstack/react-query';
import { fetchSubtitles } from '@/services/subtitle';
import { originalLanguageFromTitle, type ImdbTitle } from '@/utils/imdb';
import type { EmbedParams } from '@/utils/parse-embed-path';

export function useSubtitlesQuery(
  params: EmbedParams | null,
  imdbId: string | null,
  titleData: ImdbTitle | undefined,
) {
  let language: string | null = null;
  try {
    language = titleData ? originalLanguageFromTitle(titleData).code : null;
  } catch {
    language = null;
  }

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
      fetchSubtitles({ params: params!, imdbId: imdbId!, languages: language! }, signal),
    enabled: !!(params && imdbId && language),
    staleTime: Infinity,
  });
}
