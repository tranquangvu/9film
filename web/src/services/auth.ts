import { apiFetch } from '@/lib/api-fetch';
import type { AuthUser } from '@/types';

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export function signup(body: { username: string }): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/api/auth/signup', { method: 'POST', body, auth: false });
}

export function login(body: { username: string }): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/api/auth/login', { method: 'POST', body, auth: false });
}
