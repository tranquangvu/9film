import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCredentials, saveCredentials, type CredentialPatch, type CredentialStatus } from '@/services/user';
import { useAuth } from '@/context/auth-context';

const CREDENTIALS_KEY = ['credentials'] as const;

export function useCredentialsQuery() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: CREDENTIALS_KEY,
    queryFn: getCredentials,
    enabled: isAuthenticated,
    staleTime: 60 * 1000,
  });
}

export function useSaveCredentials() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: CredentialPatch) => saveCredentials(patch),
    onSuccess: (status: CredentialStatus) => qc.setQueryData(CREDENTIALS_KEY, status),
  });
}
