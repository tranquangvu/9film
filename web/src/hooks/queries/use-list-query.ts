import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getList, addListItem, removeListItem, type ListItem, type ListKind } from '@/services/user';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/components/ui/toast';

const listKey = (kind: ListKind) => ['list', kind] as const;

export function useListQuery(kind: ListKind) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: listKey(kind),
    queryFn: () => getList(kind),
    enabled: isAuthenticated,
    staleTime: 60 * 1000,
  });
}

export const useFavorites = () => useListQuery('favorite');
export const useWatchlist = () => useListQuery('watchlist');

export function useIsInList(imdbId: string, kind: ListKind): boolean {
  const { data } = useListQuery(kind);
  return (data ?? []).some((i) => i.imdbId === imdbId);
}

interface ToggleVars {
  imdbId: string;
  mediaType: 'movie' | 'series';
  active: boolean; // currently in the list?
}

export function useToggleListItem(kind: ListKind) {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ imdbId, mediaType, active }: ToggleVars) => {
      if (active) await removeListItem(imdbId, kind);
      else await addListItem({ imdbId, kind, mediaType });
    },
    onMutate: async ({ imdbId, mediaType, active }) => {
      await qc.cancelQueries({ queryKey: listKey(kind) });
      const prev = qc.getQueryData<ListItem[]>(listKey(kind));
      qc.setQueryData<ListItem[]>(listKey(kind), (old = []) =>
        active
          ? old.filter((i) => i.imdbId !== imdbId)
          : [{ imdbId, kind, mediaType }, ...old],
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(listKey(kind), ctx.prev);
      toast({ title: 'Could not update your list', description: 'Please try again.', variant: 'destructive' });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: listKey(kind) });
    },
  });
}

// Convenience for buttons on cards / detail page: derives current membership and
// returns a toggle handler that redirects to /login when signed out.
export function useListButton(imdbId: string, mediaType: 'movie' | 'series', kind: ListKind) {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const active = useIsInList(imdbId, kind);
  const toggle = useToggleListItem(kind);

  const onToggle = useCallback(
    (e?: { stopPropagation?: () => void; preventDefault?: () => void }) => {
      e?.stopPropagation?.();
      e?.preventDefault?.();
      if (!isAuthenticated) {
        navigate('/login');
        return;
      }
      toggle.mutate({ imdbId, mediaType, active });
    },
    [isAuthenticated, navigate, toggle, imdbId, mediaType, active],
  );

  return { active, onToggle };
}
