import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getList, addListItem, removeListItem, type ListItem } from '@/services/user';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/components/ui/toast';

const LIST_KEY = ['list'] as const;

export function useFavorites() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: LIST_KEY,
    queryFn: getList,
    enabled: isAuthenticated,
    staleTime: 60 * 1000,
  });
}

// Subscribes to the favorites query but `select`s down to a single boolean, so a
// subscriber only re-renders when *its* membership flips — not on every list
// change. Critical for grids that mount many cards: toggling one item won't
// re-render the rest.
export function useIsInList(imdbId: string): boolean {
  const { isAuthenticated } = useAuth();
  return (
    useQuery({
      queryKey: LIST_KEY,
      queryFn: getList,
      enabled: isAuthenticated,
      staleTime: 60 * 1000,
      select: (data) => data.some((i) => i.imdbId === imdbId),
    }).data ?? false
  );
}

interface ToggleVars {
  imdbId: string;
  mediaType: 'movie' | 'series';
  active: boolean; // currently favorited?
}

export function useToggleListItem() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ imdbId, mediaType, active }: ToggleVars) => {
      if (active) await removeListItem(imdbId);
      else await addListItem({ imdbId, mediaType });
    },
    onMutate: async ({ imdbId, mediaType, active }) => {
      await qc.cancelQueries({ queryKey: LIST_KEY });
      const prev = qc.getQueryData<ListItem[]>(LIST_KEY);
      qc.setQueryData<ListItem[]>(LIST_KEY, (old = []) =>
        active
          ? old.filter((i) => i.imdbId !== imdbId)
          : [{ imdbId, mediaType }, ...old],
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(LIST_KEY, ctx.prev);
      toast({ title: 'Could not update your list', description: 'Please try again.', variant: 'destructive' });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}

// Convenience for the favorite button on cards / detail page: derives current
// membership and returns a toggle handler that redirects to /login when signed out.
export function useListButton(imdbId: string, mediaType: 'movie' | 'series') {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const active = useIsInList(imdbId);
  const toggle = useToggleListItem();

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
