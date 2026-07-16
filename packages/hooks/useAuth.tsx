import { createContext, useContext, useState, useRef, useEffect, useCallback, type ReactNode } from "react";

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  districtId?: string;
  adminDistrictId?: string | null;
  balance: number;
  totpEnabled?: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  authServiceUrl: string;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<string | null>;
  getAccessToken: () => string | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
  authServiceUrl: string;
}

export function AuthProvider({ children, authServiceUrl }: AuthProviderProps) {
  const AUTH_SERVICE_URL = authServiceUrl;
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const accessTokenRef = useRef<string | null>(null);
  const csrfTokenRef = useRef<string | null>(null);
  // Dedup concurrent refreshes: the refresh token is single-use (rotated), so two
  // in-flight calls would race — the second hits the already-consumed token and 401s,
  // wiping auth state. Sharing one promise makes all callers see the same result.
  const refreshInFlightRef = useRef<Promise<string | null> | null>(null);

  const getAccessToken = useCallback(() => accessTokenRef.current, []);

  const bootstrapCsrf = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch(`${AUTH_SERVICE_URL}/auth/csrf`, { credentials: "include" });
      if (!res.ok) return null;
      const data = await res.json();
      const token = typeof data.csrf_token === "string" && data.csrf_token ? data.csrf_token : null;
      csrfTokenRef.current = token;
      return token;
    } catch {
      return null;
    }
  }, [AUTH_SERVICE_URL]);

  const refresh = useCallback((): Promise<string | null> => {
    // Coalesce concurrent calls onto a single in-flight request.
    if (refreshInFlightRef.current) return refreshInFlightRef.current;

    const run = async (): Promise<string | null> => {
      try {
        const csrf = csrfTokenRef.current ?? (await bootstrapCsrf());
        if (!csrf) {
          accessTokenRef.current = null;
          setUser(null);
          return null;
        }

        const res = await fetch(`${AUTH_SERVICE_URL}/auth/refresh`, {
          method: "POST",
          credentials: "include",
          headers: { "X-CSRF-Token": csrf },
        });

        if (!res.ok) {
          accessTokenRef.current = null;
          csrfTokenRef.current = null;
          setUser(null);
          return null;
        }

        const data = await res.json();
        accessTokenRef.current = data.access_token;
        if (typeof data.csrf_token === "string") csrfTokenRef.current = data.csrf_token;

        const infoRes = await fetch(`${AUTH_SERVICE_URL}/auth/userinfo`, {
          headers: { Authorization: `Bearer ${data.access_token}` },
        });
        if (infoRes.ok) setUser(await infoRes.json());

        return data.access_token;
      } catch {
        accessTokenRef.current = null;
        csrfTokenRef.current = null;
        setUser(null);
        return null;
      }
    };

    const promise = run().finally(() => {
      refreshInFlightRef.current = null;
    });
    refreshInFlightRef.current = promise;
    return promise;
  }, [AUTH_SERVICE_URL, bootstrapCsrf]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await fetch(`${AUTH_SERVICE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Login failed");
      }

      const data = await res.json();
      accessTokenRef.current = data.access_token;
      if (typeof data.csrf_token === "string") csrfTokenRef.current = data.csrf_token;
      setUser(data.user);
    },
    [AUTH_SERVICE_URL],
  );

  const logout = useCallback(async () => {
    try {
      const csrf = csrfTokenRef.current ?? (await bootstrapCsrf());
      await fetch(`${AUTH_SERVICE_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
        headers: csrf ? { "X-CSRF-Token": csrf } : {},
      });
    } finally {
      accessTokenRef.current = null;
      csrfTokenRef.current = null;
      setUser(null);
    }
  }, [AUTH_SERVICE_URL, bootstrapCsrf]);

  // Seed a token handed back in the URL (auth-service redirects to
  // `?access_token=…` after login), then fall back to a silent refresh. Consuming
  // the URL token means a hard load / deep link lands authenticated instead of
  // bouncing to the login form; stripping it keeps the token out of history,
  // Referer headers and server logs.
  useEffect(() => {
    const url = new URL(window.location.href);
    const urlToken = url.searchParams.get("access_token");

    const boot = async () => {
      if (!urlToken) {
        await refresh();
        return;
      }
      accessTokenRef.current = urlToken;
      try {
        const infoRes = await fetch(`${AUTH_SERVICE_URL}/auth/userinfo`, {
          headers: { Authorization: `Bearer ${urlToken}` },
        });
        if (infoRes.ok) {
          setUser(await infoRes.json());
        } else {
          // Stale/invalid token in the URL — try the refresh cookie instead.
          accessTokenRef.current = null;
          await refresh();
        }
      } finally {
        url.searchParams.delete("access_token");
        window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
      }
    };

    boot().finally(() => setIsLoading(false));
  }, [refresh, AUTH_SERVICE_URL]);

  const value: AuthContextType = {
    user,
    // Derive from reactive state, not the token ref: a ref update never triggers a
    // re-render, so `isAuthenticated` would only recompute incidentally. `setUser`
    // co-fires with every token change (set on login/refresh, cleared on logout).
    isAuthenticated: !!user,
    isLoading,
    authServiceUrl,
    login,
    logout,
    refresh,
    getAccessToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
