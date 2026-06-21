import { apiFetch, apiFetchBlob } from '@/lib/api-fetch';
import type { AuthUser } from '@/types';
import type { TitleDetail } from '@/utils/title';

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
  learningMode: boolean;
  learningLang: string;
}

export type WordImageStatus = '' | 'pending' | 'ready' | 'failed';

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
  /** AI illustration state: ''=none/legacy, pending, ready, failed. */
  imageStatus?: WordImageStatus;
  /** Cache-bust token bumped each time the illustration is (re)generated. */
  imageUpdatedAt?: string;
  /** '' = personal (saved while watching), 'oxford3000' = imported starter pack. */
  list?: string;
}

export function getMe(): Promise<AuthUser> {
  return apiFetch<AuthUser>('/api/me');
}

// Updates the signed-in user's username and avatar. Returns the updated user.
export function updateMe(body: { username: string; avatar: string }): Promise<AuthUser> {
  return apiFetch<AuthUser>('/api/me', { method: 'PUT', body });
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

export function putProgress(body: ProgressItem): Promise<ProgressItem> {
  return apiFetch<ProgressItem>('/api/me/history', { method: 'PUT', body });
}

// A resume point with its IMDb title detail embedded, so the client renders the
// Continue Watching list without a separate /api/title/:id call per title.
export interface ContinueWatchingItem extends ProgressItem {
  title?: TitleDetail;
}

export interface ContinueWatchingPage {
  items: ContinueWatchingItem[];
  hasMore: boolean;
  nextOffset: number;
}

// Paginated, deduped-per-title resume list backing the Continue Watching grid.
export async function getContinueWatching(offset = 0, limit = 20): Promise<ContinueWatchingPage> {
  const params = new URLSearchParams({ offset: String(offset), limit: String(limit) });
  const res = await apiFetch<Partial<ContinueWatchingPage>>(`/api/me/history?${params}`);
  return { items: res.items ?? [], hasMore: res.hasMore ?? false, nextOffset: res.nextOffset ?? offset };
}

export interface SubtitleItem {
  imdbId: string;
  season: number;
  episode: number;
  fileId: number;
  language: string;
}

export function putSubtitle(body: SubtitleItem): Promise<SubtitleItem> {
  return apiFetch<SubtitleItem>('/api/me/subtitles', { method: 'PUT', body });
}

export type WordStatus = 'learn' | 'completed';

export interface WordsPage {
  items: Word[];
  hasMore: boolean;
  nextOffset: number;
}

// One paginated page of saved words for a tab + list. Mirrors the
// continue-watching pagination shape so the learning lists can infinite-scroll.
export async function getWords(
  status: WordStatus,
  offset = 0,
  limit = 30,
  list = '',
): Promise<WordsPage> {
  const params = new URLSearchParams({ status, offset: String(offset), limit: String(limit) });
  if (list) params.set('list', list);
  const res = await apiFetch<WordsPage>(`/api/me/words?${params}`);
  return { items: res.items ?? [], hasMore: res.hasMore ?? false, nextOffset: res.nextOffset ?? offset };
}

// Lightweight full vocabulary (word + dates only) for the progress chart, the
// to-learn/completed counts, and the saved-word lookup — none of which can rely
// on the paginated list.
export interface WordStat {
  word: string;
  createdAt?: string;
  completedAt?: string;
  list?: string;
}

export async function getWordStats(): Promise<WordStat[]> {
  const res = await apiFetch<{ items: WordStat[] }>('/api/me/words/stats');
  return res.items ?? [];
}

export function addWord(body: Omit<Word, 'createdAt' | 'completedAt'>): Promise<Word> {
  return apiFetch<Word>('/api/me/words', { method: 'POST', body });
}

// Bulk-imports a bundled starter word list (e.g. the Oxford 3000) into the
// user's vocabulary. Returns how many words were newly added.
export function importWordList(list: string): Promise<{ added: number }> {
  return apiFetch('/api/me/words/import', { method: 'POST', body: { list } });
}

// The authed image URL (with cache-bust token); fetched as a blob since an <img>
// can't send the bearer token.
export function wordImagePath(word: string, v?: string): string {
  const p = new URLSearchParams({ word: word.toLowerCase() });
  if (v) p.set('v', v);
  return `/api/me/words/image?${p}`;
}

export async function getWordImageObjectUrl(word: string, v?: string): Promise<string> {
  const blob = await apiFetchBlob(wordImagePath(word, v));
  return URL.createObjectURL(blob);
}

// (Re)generates the illustration for an existing word — backfills legacy words
// and retries failures.
export function regenerateWordImage(word: string): Promise<{ imageStatus: WordImageStatus }> {
  return apiFetch('/api/me/words/image', { method: 'POST', body: { word: word.toLowerCase() } });
}

export function removeWord(word: string): Promise<void> {
  return apiFetch<void>(`/api/me/words?word=${encodeURIComponent(word)}`, { method: 'DELETE' });
}

export function completeWord(word: string): Promise<void> {
  return apiFetch<void>('/api/me/words/complete', { method: 'PUT', body: { word } });
}
