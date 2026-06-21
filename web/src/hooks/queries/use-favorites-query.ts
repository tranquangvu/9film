import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getFavorites, addFavorite, removeFavorite, type FavoriteItem } from '@/services/user';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/components/ui/toast';

const FAVORITES_KEY = ['favorites'] as const;

// Session map of titles toggled this session: imdbId → favorited?. The backend
// now stamps each title with `isFavorite` (see Title.isFavorite), so cards seed
// their heart from that and never need the full list just to render. This map
// layers the user's in-session toggles on top so the heart flips instantly
// everywhere without re-fetching. Held in the query cache (never fetched) so
// cards can subscribe to just their own entry.
const OVERRIDES_KEY = ['favorite-overrides'] as const;
type Overrides = Record<string, boolean>;

export function useFavorites() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: FAVORITES_KEY,
    queryFn: getFavorites,
    enabled: isAuthenticated,
    staleTime: 60 * 1000,
  });
}

// Heart state for one title: a session toggle override wins; otherwise the
// backend-provided seed. The `select` means a card only re-renders when *its*
// own membership flips — not on every toggle elsewhere.
export function useIsFavorite(imdbId: string, seed = false): boolean {
  const { data: override } = useQuery({
    queryKey: OVERRIDES_KEY,
    queryFn: () => ({}) as Overrides,
    enabled: false,
    initialData: {} as Overrides,
    staleTime: Infinity,
    gcTime: Infinity,
    select: (m: Overrides) => m[imdbId],
  });
  return override ?? seed;
}

interface ToggleVars {
  imdbId: string;
  mediaType: 'movie' | 'series';
  active: boolean; // currently favorited?
}

export function useToggleFavorite() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ imdbId, mediaType, active }: ToggleVars) => {
      if (active) await removeFavorite(imdbId);
      else await addFavorite({ imdbId, mediaType });
    },
    onMutate: async ({ imdbId, mediaType, active }) => {
      await qc.cancelQueries({ queryKey: FAVORITES_KEY });
      // Flip this title's heart everywhere (override = the new, opposite state).
      const prevOverrides = qc.getQueryData<Overrides>(OVERRIDES_KEY);
      qc.setQueryData<Overrides>(OVERRIDES_KEY, (m = {}) => ({ ...m, [imdbId]: !active }));
      // Keep the My List grid's favorites cache in sync when it's loaded.
      const prevFavorites = qc.getQueryData<FavoriteItem[]>(FAVORITES_KEY);
      if (prevFavorites) {
        qc.setQueryData<FavoriteItem[]>(
          FAVORITES_KEY,
          active ? prevFavorites.filter((i) => i.imdbId !== imdbId) : [{ imdbId, mediaType }, ...prevFavorites],
        );
      }
      return { prevOverrides, prevFavorites };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prevOverrides) qc.setQueryData(OVERRIDES_KEY, ctx.prevOverrides);
      if (ctx?.prevFavorites !== undefined) qc.setQueryData(FAVORITES_KEY, ctx.prevFavorites);
      toast({ title: 'Could not update your favorites', description: 'Please try again.', variant: 'destructive' });
    },
    onSettled: () => {
      // Refresh the authoritative list only when it's actually in use (My List).
      if (qc.getQueryData(FAVORITES_KEY)) qc.invalidateQueries({ queryKey: FAVORITES_KEY });
    },
  });
}

// Convenience for the favorite button on cards / detail page: derives current
// membership (seeded by the backend `isFavorite`) and returns a toggle handler
// that redirects to /login when signed out.
export function useFavoriteButton(imdbId: string, mediaType: 'movie' | 'series', seed = false) {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const active = useIsFavorite(imdbId, seed);
  const toggle = useToggleFavorite();

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
