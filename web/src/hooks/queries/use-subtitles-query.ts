import { useQuery } from '@tanstack/react-query';
import { getSubtitles } from '@/services/subtitle';
import { origLang, type TitleDetail } from '@/utils/title';
import type { EmbedParams } from '@/utils/stream';

export function useSubtitlesQuery(
  params: EmbedParams | null,
  imdbId: string | null,
  titleData: TitleDetail | undefined,
) {
  let language: string | null = null;
  try {
    language = titleData ? origLang(titleData).code : null;
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
      getSubtitles({ params: params!, imdbId: imdbId!, languages: language! }, signal),
    enabled: !!(params && imdbId && language),
    staleTime: Infinity,
  });
}
