import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider, Toaster } from "@/components/ui/toast";

import MainLayout from "@/components/system/layout/main-layout";
import WatchLayout from "@/components/system/layout/watch-layout";
import { OnboardingGate } from "@/components/system/common/onboarding-gate";

import HomePage from "@/pages/home-page";
import BrowsePage from "@/pages/browse-page";
import TitleDetailPage from "@/pages/title-detail-page";
import { WatchPage } from "@/pages/watch-page";
import MyListPage from "@/pages/my-list-page";
import MyLearningPage from "@/pages/my-learning-page";
import MyLearningOxford3000 from "@/pages/my-learning-oxford-3000-page";
import MyLearningInsightsPage from "@/pages/my-learning-insights-page";
import MyLearningTestResultsPage from "@/pages/my-learning-test-results-page";
import SearchPage from "@/pages/search-page";
import ProfilePage from "@/pages/profile-page";
import TitlesPage from "@/pages/titles-page";
import TvSeriesPage from "@/pages/tv-series-page";
import NotFoundPage from "@/pages/not-found-page";
import AboutPage from "@/pages/about-page";
import DisclaimerPage from "@/pages/disclaimer-page";
import OnboardingPage from "@/pages/onboarding-page";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // IMDb metadata (titles, casts, genres, similar) rarely changes —
      // treat it as fresh for 5 min so navigating back to a page is instant.
      staleTime: 5 * 60 * 1000,
      // Keep unused data around for 30 min so back/forward nav stays a cache hit.
      gcTime: 30 * 60 * 1000,
      // Don't retry client errors (404 for a bad title id, 503 for a missing
      // provider key, etc.) — only transient ones.
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
  // Outside the onboarding gate: the welcome flow itself, plus the two static
  // pages it links to (Disclaimer opens in a new tab from step one, which the
  // gate would otherwise bounce straight back into the flow).
  { path: "/welcome", element: <OnboardingPage /> },
  {
    element: <MainLayout />,
    children: [
      { path: "/about", element: <AboutPage /> },
      { path: "/disclaimer", element: <DisclaimerPage /> },
    ],
  },
  {
    element: <OnboardingGate />,
    children: [
      {
        element: <MainLayout />,
        children: [
          { path: "/", element: <HomePage /> },
          { path: "/browse", element: <BrowsePage /> },
          { path: "/movies", element: <TitlesPage /> },
          { path: "/tvs", element: <TvSeriesPage /> },
          { path: "/title/:id", element: <TitleDetailPage /> },
          { path: "/search", element: <SearchPage /> },
          { path: "/my-list", element: <MyListPage /> },
          { path: "/my-learning", element: <MyLearningPage /> },
          { path: "/my-learning/insights", element: <MyLearningInsightsPage /> },
          { path: "/my-learning/test-results", element: <MyLearningTestResultsPage /> },
          { path: "/my-learning/the-oxford-3000", element: <MyLearningOxford3000 /> },
          { path: "/profile", element: <ProfilePage /> },
          { path: "*", element: <NotFoundPage /> },
        ],
      },
      {
        element: <WatchLayout />,
        children: [{ path: "/watch/:id", element: <WatchPage /> }],
      },
    ],
  },
]);

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <RouterProvider router={router} />
        <Toaster />
      </ToastProvider>
    </QueryClientProvider>
  );
}
