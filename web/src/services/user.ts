import { apiFetch } from '@/lib/api-fetch';
import type { AuthUser } from '@/types';

export interface ListItem {
  imdbId: string;
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
  learningMode: boolean;
  learningLang: string;
}

export interface SavedWord {
  word: string;
  sentence: string;
  translation: string;
  imdbId: string;
  season: number;
  episode: number;
  timestamp: number;
  box: number;
  dueAt?: string;
  createdAt?: string;
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

export async function getList(): Promise<ListItem[]> {
  const res = await apiFetch<{ items: ListItem[] }>('/api/me/list');
  return res.items ?? [];
}

export function addListItem(body: { imdbId: string; mediaType: 'movie' | 'series' }): Promise<ListItem> {
  return apiFetch<ListItem>('/api/me/list', { method: 'POST', body });
}

export function removeListItem(imdbId: string): Promise<void> {
  const params = new URLSearchParams({ imdbId });
  return apiFetch<void>(`/api/me/list?${params}`, { method: 'DELETE' });
}

export async function getProgress(): Promise<ProgressItem[]> {
  const res = await apiFetch<{ items: ProgressItem[] }>('/api/me/progress');
  return res.items ?? [];
}

export function putProgress(body: ProgressItem): Promise<ProgressItem> {
  return apiFetch<ProgressItem>('/api/me/progress', { method: 'PUT', body });
}

export async function getSavedWords(): Promise<SavedWord[]> {
  const res = await apiFetch<{ items: SavedWord[] }>('/api/me/saved-words');
  return res.items ?? [];
}

export function addSavedWord(body: Omit<SavedWord, 'box' | 'dueAt' | 'createdAt'>): Promise<SavedWord> {
  return apiFetch<SavedWord>('/api/me/saved-words', { method: 'POST', body });
}

export function removeSavedWord(word: string): Promise<void> {
  return apiFetch<void>(`/api/me/saved-words?word=${encodeURIComponent(word)}`, { method: 'DELETE' });
}

export function reviewSavedWord(body: { word: string; box: number; intervalDays: number }): Promise<void> {
  return apiFetch<void>('/api/me/saved-words/review', { method: 'PUT', body });
}
