import {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { registerAuth } from '@/lib/api-fetch';
import { login as loginSvc, signup as signupSvc, type AuthResponse } from '@/services/auth';
import { getMe } from '@/services/user';
import type { AuthUser } from '@/types';

const TOKEN_KEY = 'nicefilm_token';

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string) => Promise<void>;
  signup: (username: string) => Promise<void>;
  updateUser: (user: AuthUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const tokenRef = useRef<string | null>(localStorage.getItem(TOKEN_KEY));
  const bootstrapped = useRef(false);
  const queryClient = useQueryClient();

  const logout = useCallback(() => {
    tokenRef.current = null;
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    // Drop any per-user cached data (lists, progress, settings).
    queryClient.clear();
  }, [queryClient]);

  // Register the token getter + 401 handler, then rehydrate the session from a
  // stored token. Registration happens before getMe so apiFetch sees the token.
  useEffect(() => {
    registerAuth(() => tokenRef.current, logout);
    // Rehydrate the session once per app load. Guarded so React StrictMode's
    // double-invoked effect (dev) doesn't fire a second /api/me.
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    if (!tokenRef.current) {
      setIsLoading(false);
      return;
    }
    getMe()
      .then(setUser)
      .catch(() => logout())
      .finally(() => setIsLoading(false));
  }, [logout]);

  const applyAuth = useCallback((res: AuthResponse) => {
    tokenRef.current = res.token;
    localStorage.setItem(TOKEN_KEY, res.token);
    setUser(res.user);
  }, []);

  const login = useCallback(
    async (username: string) => {
      applyAuth(await loginSvc({ username }));
    },
    [applyAuth],
  );

  const signup = useCallback(
    async (username: string) => {
      applyAuth(await signupSvc({ username }));
    },
    [applyAuth],
  );

  // Reflect a profile edit (username/avatar) into the session everywhere.
  const updateUser = useCallback((u: AuthUser) => setUser(u), []);

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: !!user, isLoading, login, signup, updateUser, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
