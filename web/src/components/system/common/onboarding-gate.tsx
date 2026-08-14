import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useOnboarded } from '@/hooks/use-onboarding';

// Holds every app route back until the welcome flow has been walked through, so
// the licence notice and the API-key ask happen once, up front, instead of
// ambushing you mid-feature. The static About/Disclaimer pages are wired outside
// this gate — the flow itself links to Disclaimer.
export function OnboardingGate() {
  const onboarded = useOnboarded();
  const location = useLocation();

  if (!onboarded) {
    // Remember where we came from so finishing lands there, not on home.
    return <Navigate to="/welcome" replace state={{ from: location.pathname + location.search }} />;
  }

  return <Outlet />;
}
