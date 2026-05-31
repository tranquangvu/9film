import { useQuery } from '@tanstack/react-query';
import { fetchBrowse, fetchPopular, fetchTrending } from '@/services/title';

export function usePopularTitles(limit = 20) {
  return useQuery({
    queryKey: ['titles', 'popular', limit],
    queryFn: ({ signal }) => fetchPopular(limit, signal),
    staleTime: 5 * 60 * 1000,
  });
}

export function useTrendingTitles(limit = 20) {
  return useQuery({
    queryKey: ['titles', 'trending', limit],
    queryFn: ({ signal }) => fetchTrending(limit, signal),
    staleTime: 5 * 60 * 1000,
  });
}

export function useBrowseTitles(opts: {
  type?: string;
  genre?: string;
  first?: number;
  after?: string;
  minRating?: number;
}) {
  return useQuery({
    queryKey: ['titles', 'browse', opts],
    queryFn: ({ signal }) => fetchBrowse(opts, signal),
    staleTime: 5 * 60 * 1000,
  });
}
