import { useMemo } from 'react';
import { useBrowseTitlesInfinite } from './queries/use-browse-title-query';
import { useSearchQuery } from './queries/use-search-query';
import { useTitleQuery } from './queries/use-title-query';
import { isImdb } from '@/utils/stream';
import { toTitles } from '@/utils/title';
import type { Title } from '@/types';

interface TitleListing {
  searching: boolean;
  titles: Title[];
  isLoading: boolean;
  isError: boolean;
  // Pagination (browse feed only — the search/id sources return a single page).
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
}

// Resolves the title list for a browse/listing page (Browse, Titles, TV Series)
// from one of three sources, based on the free-text search term:
//   • IMDb id (e.g. tt2575988) → single-title lookup by id
//   • any other text           → title-name search endpoint
//   • empty                    → popularity browse feed (type/genre constrained,
//                                 cursor-paginated)
// Only the active source's query runs; the others are disabled. Callers still
// apply type/genre filtering on the returned titles (the search/id endpoints
// don't honor those constraints).
export function useTitleListing(opts: {
  searchTerm: string;
  type?: string;
  genre?: string;
}): TitleListing {
  const { searchTerm, type, genre } = opts;
  const searching = searchTerm.length > 0;
  const byId = searching && isImdb(searchTerm);

  const browse = useBrowseTitlesInfinite({ type, genre, first: 50 }, !searching);
  const search = useSearchQuery(byId ? '' : searchTerm, 50);
  const titleLookup = useTitleQuery(byId ? searchTerm : '');

  const source = !searching ? browse : byId ? titleLookup : search;

  // Map IMDb titles → Title DTOs here, memoized on the raw query data, so it only
  // reruns when a page/result actually changes — not on every filter toggle or
  // re-render in the consuming page.
  const titles = useMemo<Title[]>(() => {
    if (!searching) return toTitles(browse.data?.pages.flatMap((p) => p.titles) ?? []);
    if (byId) return titleLookup.data ? toTitles([titleLookup.data]) : [];
    return toTitles(search.data ?? []);
  }, [searching, byId, browse.data, titleLookup.data, search.data]);

  return {
    searching,
    titles,
    isLoading: source.isLoading,
    isError: byId ? false : !!source.isError,
    hasNextPage: !searching && browse.hasNextPage,
    isFetchingNextPage: browse.isFetchingNextPage,
    fetchNextPage: browse.fetchNextPage,
  };
}
