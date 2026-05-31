import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import MainLayout from '@/components/system/layout/main-layout';
import WatchLayout from '@/components/system/layout/watch-layout';

import HomePage from '@/pages/home-page';
import BrowsePage from '@/pages/browse-page';
import CategoriesPage from '@/pages/categories-page';
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
      retry: 3,
      staleTime: 0,
      refetchOnWindowFocus: false,
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
      { path: '/categories', element: <CategoriesPage /> },
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
