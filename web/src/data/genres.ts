import type { Genre } from '@/types';

export const genres: Genre[] = [
  { id: 'action', name: 'Action', icon: '💥', color: '#ef4444', count: 142 },
  { id: 'drama', name: 'Drama', icon: '🎭', color: '#8b5cf6', count: 198 },
  { id: 'anime', name: 'Anime', icon: '⛩️', color: '#ec4899', count: 87 },
  { id: 'sci-fi', name: 'Sci-Fi', icon: '🚀', color: '#3b82f6', count: 96 },
  { id: 'horror', name: 'Horror', icon: '👻', color: '#b91c1c', count: 74 },
  { id: 'documentary', name: 'Documentary', icon: '🎬', color: '#10b981', count: 53 },
  { id: 'comedy', name: 'Comedy', icon: '😂', color: '#f59e0b', count: 121 },
  { id: 'kids', name: 'Kids', icon: '🌈', color: '#06b6d4', count: 68 },
  { id: 'thriller', name: 'Thriller', icon: '😰', color: '#f97316', count: 89 },
  { id: 'romance', name: 'Romance', icon: '💕', color: '#f43f5e', count: 77 },
  { id: 'crime', name: 'Crime', icon: '🔍', color: '#0891b2', count: 112 },
  { id: 'adventure', name: 'Adventure', icon: '🗺️', color: '#84cc16', count: 93 },
];

export function genreName(id: string): string {
  return genres.find((g) => g.id === id)?.name ?? id;
}
