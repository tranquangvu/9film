import { apiFetch } from '@/lib/api-fetch';
import type { AuthUser } from '@/types';
import type { ImdbTitle } from '@/utils/title';

export interface FavoriteItem {
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

export interface Word {
  word: string;
  sentence: string;
  translation: string;
  imdbId: string;
  season: number;
  episode: number;
  timestamp: number;
  createdAt?: string;
  /** Set once the word has been learned; empty string while still in the added list. */
  completedAt?: string;
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

export async function getFavorites(): Promise<FavoriteItem[]> {
  const res = await apiFetch<{ items: FavoriteItem[] }>('/api/me/favorites');
  return res.items ?? [];
}

export function addFavorite(body: { imdbId: string; mediaType: 'movie' | 'series' }): Promise<FavoriteItem> {
  return apiFetch<FavoriteItem>('/api/me/favorites', { method: 'POST', body });
}

export function removeFavorite(imdbId: string): Promise<void> {
  const params = new URLSearchParams({ imdbId });
  return apiFetch<void>(`/api/me/favorites?${params}`, { method: 'DELETE' });
}

export async function getProgress(): Promise<ProgressItem[]> {
  const res = await apiFetch<{ items: ProgressItem[] }>('/api/me/progress');
  return res.items ?? [];
}

export function putProgress(body: ProgressItem): Promise<ProgressItem> {
  return apiFetch<ProgressItem>('/api/me/progress', { method: 'PUT', body });
}

// A resume point with its IMDb title detail embedded, so the client renders the
// Continue Watching list without a separate /api/title/:id call per title.
export interface ContinueWatchingItem extends ProgressItem {
  title?: ImdbTitle;
}

export interface ContinueWatchingPage {
  items: ContinueWatchingItem[];
  hasMore: boolean;
  nextOffset: number;
}

// Paginated, deduped-per-title resume list backing the Continue Watching grid.
export async function getContinueWatching(offset = 0, limit = 20): Promise<ContinueWatchingPage> {
  const params = new URLSearchParams({ offset: String(offset), limit: String(limit) });
  const res = await apiFetch<Partial<ContinueWatchingPage>>(`/api/me/continue-watching?${params}`);
  return { items: res.items ?? [], hasMore: res.hasMore ?? false, nextOffset: res.nextOffset ?? offset };
}

export interface SubtitleItem {
  imdbId: string;
  fileId: number;
  language: string;
}

export async function getSubtitles(): Promise<SubtitleItem[]> {
  const res = await apiFetch<{ items: SubtitleItem[] }>('/api/me/subtitles');
  return res.items ?? [];
}

export function putSubtitle(body: SubtitleItem): Promise<SubtitleItem> {
  return apiFetch<SubtitleItem>('/api/me/subtitles', { method: 'PUT', body });
}

export async function getWords(): Promise<Word[]> {
  const res = await apiFetch<{ items: Word[] }>('/api/me/words');
  return res.items ?? [];
}

export function addWord(body: Omit<Word, 'createdAt' | 'completedAt'>): Promise<Word> {
  return apiFetch<Word>('/api/me/words', { method: 'POST', body });
}

export function removeWord(word: string): Promise<void> {
  return apiFetch<void>(`/api/me/words?word=${encodeURIComponent(word)}`, { method: 'DELETE' });
}

export function completeWord(word: string): Promise<void> {
  return apiFetch<void>('/api/me/words/complete', { method: 'PUT', body: { word } });
}
