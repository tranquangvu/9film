import { useQuery } from '@tanstack/react-query';
import { getTitle, TitleNotFoundError } from '@/services/title';
import { parseId } from '@/utils/stream';

export function useTitleQuery(titleId: string) {
  const mediaId = parseId(titleId);

  return useQuery({
    queryKey: ['title', mediaId],
    queryFn: ({ signal }) => getTitle(mediaId!, signal),
    enabled: !!mediaId,
    staleTime: Infinity,
    // A missing/invalid id won't resolve on retry — fail fast.
    retry: (count, err) => !(err instanceof TitleNotFoundError) && count < 3,
  });
}
