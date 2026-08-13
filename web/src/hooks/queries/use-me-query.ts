import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMe, updateMe } from '@/services/user';
import type { LocalUser } from '@/types';

const ME_KEY = ['me'] as const;

// The local account's profile. There is no sign-in — the backend stamps every
// request with the single local user (see middleware.LocalUser), so this is
// always available rather than being gated on a session.
export function useMe() {
  return useQuery({
    queryKey: ME_KEY,
    queryFn: getMe,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { avatar: string }) => updateMe(body),
    onSuccess: (user: LocalUser) => qc.setQueryData(ME_KEY, user),
  });
}
