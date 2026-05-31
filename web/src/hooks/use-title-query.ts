import { useQuery } from '@tanstack/react-query';
import { fetchTitle } from '@/services/title';
import { parseId } from '@/utils/stream';

export function useTitleQuery(titleId: string) {
  const mediaId = parseId(titleId);

  return useQuery({
    queryKey: ['title', mediaId],
    queryFn: ({ signal }) => fetchTitle(mediaId!, signal),
    enabled: !!mediaId,
    staleTime: Infinity,
  });
}
