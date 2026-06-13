export interface Movie {
  id: string
  title: string
  tagline?: string
  description: string
  poster: string
  backdrop: string
  rating: number
  year: string
  duration: number
  genres: string[]
  cast: CastMember[]
  director: string
  language: string
  country: string
  type: 'movie' | 'series'
  episodes?: Episode[]
  trailerUrl?: string
  isTrending?: boolean
  isNew?: boolean
  isFeatured?: boolean
  progress?: number
  // Resume point for the Continue Watching row (series only; 0 for movies).
  resumeSeason?: number
  resumeEpisode?: number
  totalSeasons?: number
  totalEpisodes?: number
}

export interface CastMember {
  id: string
  name: string
  character: string
  photo: string
}

export interface Episode {
  id: string
  title: string
  number: number
  season: number
  duration: number
  thumbnail: string
  description: string
  airDate: string
}

export interface Genre {
  id: string
  name: string
  icon: string
  color: string
}

export interface UserProfile {
  id: number
  name: string
  avatar: string
  email: string
  plan: 'free' | 'premium' | 'family'
  joinDate: string
}

// The authenticated user returned by the backend (/api/auth/*, /api/me).
export interface AuthUser {
  id: number
  email: string
  name: string
  avatar: string
  plan: string
  createdAt?: string
}

export interface Notification {
  id: number
  title: string
  message: string
  time: string
  read: boolean
  thumbnail?: string
  type: 'new_release' | 'reminder' | 'recommendation'
}

export interface SearchResult {
  movies: Movie[]
  actors: CastMember[]
  categories: Genre[]
}

export type SortOption = 'popularity' | 'rating' | 'year_new' | 'year_old' | 'title_az' | 'title_za'
