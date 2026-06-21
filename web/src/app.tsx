import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider, Toaster } from "@/components/ui/toast";
import { AuthProvider } from "@/context/auth-context";
import { RequireAuth } from "@/components/system/common/require-auth";

import MainLayout from "@/components/system/layout/main-layout";
import WatchLayout from "@/components/system/layout/watch-layout";

import HomePage from "@/pages/home-page";
import BrowsePage from "@/pages/browse-page";
import TitleDetailPage from "@/pages/title-detail-page";
import { WatchPage } from "@/pages/watch-page";
import MyListPage from "@/pages/my-list-page";
import MyLearningPage from "@/pages/my-learning-page";
import LearningInsightsPage from "@/pages/learning-insights-page";
import TestResultsPage from "@/pages/test-results-page";
import SearchPage from "@/pages/search-page";
import ProfilePage from "@/pages/profile-page";
import TitlesPage from "@/pages/titles-page";
import TvSeriesPage from "@/pages/tv-series-page";
import NotFoundPage from "@/pages/not-found-page";
import LoginPage from "@/pages/login-page";
import SignupPage from "@/pages/signup-page";
import AboutPage from "@/pages/about-page";
import PrivacyPage from "@/pages/privacy-page";
import TermsPage from "@/pages/terms-page";
import DisclaimerPage from "@/pages/disclaimer-page";

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
      { path: "/", element: <HomePage /> },
      { path: "/browse", element: <BrowsePage /> },
      { path: "/movies", element: <TitlesPage /> },
      { path: "/tvs", element: <TvSeriesPage /> },
      { path: "/title/:id", element: <TitleDetailPage /> },
      { path: "/my-list", element: <RequireAuth><MyListPage /></RequireAuth> },
      { path: "/my-learning", element: <RequireAuth><MyLearningPage /></RequireAuth> },
      { path: "/my-learning/insights", element: <RequireAuth><LearningInsightsPage /></RequireAuth> },
      { path: "/my-learning/tests", element: <RequireAuth><TestResultsPage /></RequireAuth> },
      { path: "/my-learning/the-oxford-3000", element: <RequireAuth><MyLearningPage list="oxford3000" /></RequireAuth> },
      { path: "/search", element: <SearchPage /> },
      { path: "/profile", element: <RequireAuth><ProfilePage /></RequireAuth> },
      { path: "/about", element: <AboutPage /> },
      { path: "/privacy", element: <PrivacyPage /> },
      { path: "/terms", element: <TermsPage /> },
      { path: "/disclaimer", element: <DisclaimerPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
  {
    element: <WatchLayout />,
    children: [{ path: "/watch/:id", element: <WatchPage /> }],
  },
  { path: "/login", element: <LoginPage /> },
  { path: "/signup", element: <SignupPage /> },
]);

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <RouterProvider router={router} />
          <Toaster />
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
