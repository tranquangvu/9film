import { useQuery } from '@tanstack/react-query';
import { getTitle } from '@/services/title';
import { parseId } from '@/utils/stream';

export function useTitleQuery(titleId: string) {
  const mediaId = parseId(titleId);

  return useQuery({
    queryKey: ['title', mediaId],
    queryFn: ({ signal }) => getTitle(mediaId!, signal),
    enabled: !!mediaId,
    staleTime: Infinity,
  });
}
