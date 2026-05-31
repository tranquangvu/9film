import { useQuery } from '@tanstack/react-query';
import { fetchTitle } from '@/services/title';
import { parseMediaId } from '@/utils/parse-embed-path';

export function useTitleQuery(titleId: string) {
  const mediaId = parseMediaId(titleId);

  return useQuery({
    queryKey: ['title', mediaId],
    queryFn: ({ signal }) => fetchTitle(mediaId!, signal),
    enabled: !!mediaId,
    staleTime: Infinity,
  });
}
