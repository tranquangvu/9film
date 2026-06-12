import { apiFetch } from '@/lib/api-fetch';
import type { AuthUser } from '@/types';

export type ListKind = 'favorite' | 'watchlist';

export interface ListItem {
  imdbId: string;
  kind: ListKind;
  mediaType: 'movie' | 'series';
  createdAt?: string;
}

export interface ProgressItem {
  imdbId: string;
  season: number;
  episode: number;
  positionSeconds: number;
  durationSeconds: number;
  updatedAt?: string;
}

export interface UserSettings {
  autoplayNext: boolean;
  defaultSubtitleLang: string;
  defaultQuality: string;
}

export function getMe(): Promise<AuthUser> {
  return apiFetch<AuthUser>('/api/me');
}

export function getSettings(): Promise<UserSettings> {
  return apiFetch<UserSettings>('/api/me/settings');
}

export function putSettings(body: Partial<UserSettings>): Promise<UserSettings> {
  return apiFetch<UserSettings>('/api/me/settings', { method: 'PUT', body });
}

export async function getList(kind: ListKind): Promise<ListItem[]> {
  const res = await apiFetch<{ items: ListItem[] }>(`/api/me/list?kind=${kind}`);
  return res.items ?? [];
}

export function addListItem(body: { imdbId: string; kind: ListKind; mediaType: 'movie' | 'series' }): Promise<ListItem> {
  return apiFetch<ListItem>('/api/me/list', { method: 'POST', body });
}

export function removeListItem(imdbId: string, kind: ListKind): Promise<void> {
  const params = new URLSearchParams({ imdbId, kind });
  return apiFetch<void>(`/api/me/list?${params}`, { method: 'DELETE' });
}

export async function getProgress(): Promise<ProgressItem[]> {
  const res = await apiFetch<{ items: ProgressItem[] }>('/api/me/progress');
  return res.items ?? [];
}

export function putProgress(body: ProgressItem): Promise<ProgressItem> {
  return apiFetch<ProgressItem>('/api/me/progress', { method: 'PUT', body });
}
