import type { Genre } from '@/types';

export const genres: Genre[] = [
  { id: 'action', name: 'Action', icon: '💥', color: '#ef4444' },
  { id: 'adventure', name: 'Adventure', icon: '🗺️', color: '#84cc16' },
  { id: 'animation', name: 'Animation', icon: '🎨', color: '#ec4899' },
  { id: 'biography', name: 'Biography', icon: '📖', color: '#a16207' },
  { id: 'comedy', name: 'Comedy', icon: '😂', color: '#f59e0b' },
  { id: 'crime', name: 'Crime', icon: '🔍', color: '#0891b2' },
  { id: 'documentary', name: 'Documentary', icon: '🎬', color: '#10b981' },
  { id: 'drama', name: 'Drama', icon: '🎭', color: '#8b5cf6' },
  { id: 'family', name: 'Family', icon: '👨‍👩‍👧‍👦', color: '#06b6d4' },
  { id: 'fantasy', name: 'Fantasy', icon: '🧙', color: '#7c3aed' },
  { id: 'film-noir', name: 'Film-Noir', icon: '🕵️', color: '#475569' },
  { id: 'game-show', name: 'Game-Show', icon: '🎮', color: '#d946ef' },
  { id: 'history', name: 'History', icon: '🏛️', color: '#b45309' },
  { id: 'horror', name: 'Horror', icon: '👻', color: '#b91c1c' },
  { id: 'music', name: 'Music', icon: '🎵', color: '#fb7185' },
  { id: 'musical', name: 'Musical', icon: '🎼', color: '#e11d48' },
  { id: 'mystery', name: 'Mystery', icon: '🕯️', color: '#6366f1' },
  { id: 'news', name: 'News', icon: '📰', color: '#64748b' },
  { id: 'reality-tv', name: 'Reality-TV', icon: '📺', color: '#14b8a6' },
  { id: 'romance', name: 'Romance', icon: '💕', color: '#f43f5e' },
  { id: 'sci-fi', name: 'Sci-Fi', icon: '🚀', color: '#3b82f6' },
  { id: 'short', name: 'Short', icon: '⏱️', color: '#22c55e' },
  { id: 'sport', name: 'Sport', icon: '⚽', color: '#16a34a' },
  { id: 'talk-show', name: 'Talk-Show', icon: '🎙️', color: '#0ea5e9' },
  { id: 'thriller', name: 'Thriller', icon: '😰', color: '#f97316' },
  { id: 'war', name: 'War', icon: '⚔️', color: '#78716c' },
  { id: 'western', name: 'Western', icon: '🤠', color: '#ca8a04' },
];

export function genreName(id: string): string {
  return genres.find((g) => g.id === id)?.name ?? id;
}
