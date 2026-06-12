import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/auth-context';

// Gate a route behind authentication. Waits for the initial session rehydrate
// to finish before deciding, so a logged-in user with a stored token isn't
// flashed to /login on a hard refresh.
export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 rounded-full border-2 border-white/15 border-t-orange-500 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={`/login?from=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  return <>{children}</>;
}
