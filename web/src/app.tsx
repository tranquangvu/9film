import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import MainLayout from '@/components/system/layout/main-layout';
import WatchLayout from '@/components/system/layout/watch-layout';

import HomePage from '@/pages/home-page';
import BrowsePage from '@/pages/browse-page';
import MovieDetailPage from '@/pages/movie-detail-page';
import { WatchPage } from '@/pages/watch-page';
import MyListPage from '@/pages/my-list-page';
import SearchPage from '@/pages/search-page';
import ProfilePage from '@/pages/profile-page';
import MoviesPage from '@/pages/movies-page';
import TvSeriesPage from '@/pages/tv-series-page';
import NotFoundPage from '@/pages/not-found-page';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // IMDb metadata (titles, casts, genres, similar) rarely changes —
      // treat it as fresh for 5 min so navigating back to a page is instant.
      staleTime: 5 * 60 * 1000,
      // Keep unused data around for 30 min so back/forward nav stays a cache hit.
      gcTime: 30 * 60 * 1000,
      // Don't retry client errors (404 for a bad title id, 401, etc.) — only transient ones.
      retry: (failureCount, error) => {
        const status = (error as { status?: number })?.status;
        if (status && status >= 400 && status < 500) return false;
        return failureCount < 2;
      },
      // Exponential backoff between retries; `attempt` is 0-based, so the
      // waits are 1s (2^0), 2s (2^1), 4s (2^2)… capped at 30s.
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
      // A video app shouldn't refire requests when the user tabs away and back.
      refetchOnWindowFocus: false,
      // But do recover after the network drops mid-watch.
      refetchOnReconnect: true,
    },
  },
});

const router = createBrowserRouter([
  {
    element: <MainLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/browse', element: <BrowsePage /> },
      { path: '/movies', element: <MoviesPage /> },
      { path: '/tv-series', element: <TvSeriesPage /> },
      { path: '/movie/:id', element: <MovieDetailPage /> },
      { path: '/my-list', element: <MyListPage /> },
      { path: '/search', element: <SearchPage /> },
      { path: '/profile', element: <ProfilePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    element: <WatchLayout />,
    children: [
      { path: '/watch/:id', element: <WatchPage /> },
    ],
  },
]);

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
