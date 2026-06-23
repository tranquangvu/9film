import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSettings, putSettings, type UserSettings } from '@/services/user';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/components/ui/toast';

const SETTINGS_KEY = ['settings'] as const;

export const DEFAULT_SETTINGS: UserSettings = {
  autoplayNext: true,
  defaultSubtitleLang: 'en',
  learningMode: true,
  learningLang: 'vi',
};

export function useSettingsQuery() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: getSettings,
    enabled: isAuthenticated,
    // Settings rarely change and only ever from the profile page, where the
    // mutation below invalidates this key. Treat the fetched value as
    // permanently fresh so it never refetches on remount/reconnect on its own.
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

// Settings with defaults applied — safe to read while logged out or loading so
// the player always has sane values.
export function useSettings(): UserSettings {
  const { data } = useSettingsQuery();
  return data ?? DEFAULT_SETTINGS;
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    // The backend expects the full settings object, so merge the patch over the
    // current cached value before sending.
    mutationFn: (patch: Partial<UserSettings>) => {
      const current = qc.getQueryData<UserSettings>(SETTINGS_KEY) ?? DEFAULT_SETTINGS;
      return putSettings({ ...current, ...patch });
    },
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: SETTINGS_KEY });
      const prev = qc.getQueryData<UserSettings>(SETTINGS_KEY);
      qc.setQueryData<UserSettings>(SETTINGS_KEY, { ...(prev ?? DEFAULT_SETTINGS), ...patch });
      return { prev };
    },
    // The PUT returns the authoritative settings, so write them straight into
    // cache instead of invalidating — no extra GET round-trip.
    onSuccess: (settings) => {
      qc.setQueryData(SETTINGS_KEY, settings);
    },
    onError: (_err, _patch, ctx) => {
      if (ctx?.prev) qc.setQueryData(SETTINGS_KEY, ctx.prev);
      toast({ title: 'Could not save settings', description: 'Please try again.', variant: 'destructive' });
    },
  });
}
