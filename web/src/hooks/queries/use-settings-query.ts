import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSettings, putSettings, type UserSettings } from '@/services/user';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/components/ui/toast';

const SETTINGS_KEY = ['settings'] as const;

export const DEFAULT_SETTINGS: UserSettings = {
  autoplayNext: true,
  defaultSubtitleLang: 'en',
  defaultQuality: 'auto',
  learningMode: true,
  learningLang: 'vi',
};

export function useSettingsQuery() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: getSettings,
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
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
    onError: (_err, _patch, ctx) => {
      if (ctx?.prev) qc.setQueryData(SETTINGS_KEY, ctx.prev);
      toast({ title: 'Could not save settings', description: 'Please try again.', variant: 'destructive' });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: SETTINGS_KEY });
    },
  });
}
