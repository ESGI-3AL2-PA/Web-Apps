// Cœur de l'authentification côté front : contexte + provider React qui pilote le cycle de
// vie de la session face à l'auth-service (login, refresh silencieux, logout, userinfo).
//
// Modèle de sécurité :
//  - L'access token vit uniquement en mémoire (useRef), jamais en localStorage, pour limiter
//    l'exposition au XSS.
//  - Le refresh token est un cookie httpOnly géré par le navigateur (envoyé via
//    `credentials: "include"`) ; le JS n'y touche pas.
//  - Les mutations passent par un jeton anti-CSRF (double-submit) transmis en en-tête X-CSRF-Token.
import { createContext, useContext, useState, useRef, useEffect, useCallback, useMemo, type ReactNode } from "react";

// Un login que le hook programmatique ne peut pas mener à bout seul : le compte requiert un
// second facteur (mfa) ou doit en enrôler un (enrollment). C'est la page de login HTML de
// l'auth-service qui orchestre ces cérémonies ; l'appelant du hook doit y rediriger
// l'utilisateur plutôt que de poursuivre.
export class LoginChallengeError extends Error {
  constructor(public kind: "mfa" | "enrollment") {
    super(kind === "enrollment" ? "MFA enrollment required" : "MFA verification required");
    this.name = "LoginChallengeError";
  }
}

/** Profil de l'utilisateur connecté, tel que renvoyé par l'endpoint /auth/userinfo. */
export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  /** Quartier d'appartenance de l'utilisateur. */
  districtId?: string;
  /** Quartier que l'utilisateur administre (admin de quartier) ; null s'il n'en administre aucun. */
  adminDistrictId?: string | null;
  /** Solde de points de l'utilisateur. */
  balance: number;
  /** Indique si le TOTP (second facteur) est activé sur le compte. */
  totpEnabled?: boolean;
}

/** Valeur exposée par le contexte d'auth et consommée via le hook `useAuth`. */
interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  authServiceUrl: string;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Rafraîchit la session et retourne le nouvel access token, ou null en cas d'échec. */
  refresh: () => Promise<string | null>;
  /** Lecture synchrone de l'access token courant (depuis la ref en mémoire). */
  getAccessToken: () => string | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
  authServiceUrl: string;
}

/**
 * Provider à monter à la racine de chaque front. Fournit le contexte d'auth à toute
 * l'application et déclenche au montage une tentative de restauration de session
 * (token dans l'URL, puis refresh silencieux via le cookie).
 */
export function AuthProvider({ children, authServiceUrl }: AuthProviderProps) {
  const AUTH_SERVICE_URL = authServiceUrl;
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Access token et jeton CSRF gardés en ref (mémoire) : ils changent sans devoir provoquer
  // de re-render, et l'access token n'est jamais persisté.
  const accessTokenRef = useRef<string | null>(null);
  const csrfTokenRef = useRef<string | null>(null);
  // Déduplique les refresh concurrents : le refresh token est à usage unique (rotation), donc
  // deux appels simultanés se courseraient — le second frapperait le token déjà consommé,
  // renverrait 401 et effacerait la session. Partager une seule promesse fait voir le même
  // résultat à tous les appelants.
  const refreshInFlightRef = useRef<Promise<string | null> | null>(null);

  const getAccessToken = useCallback(() => accessTokenRef.current, []);

  // Récupère un jeton anti-CSRF auprès de /auth/csrf (cookie de session associé). Retourne
  // null en cas d'échec, sans lever d'exception.
  const bootstrapCsrf = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch(`${AUTH_SERVICE_URL}/auth/csrf`, { credentials: "include" });
      if (!res.ok) return null;
      const data = await res.json();
      // On n'accepte qu'un jeton chaîne non vide ; toute autre forme → null.
      const token = typeof data.csrf_token === "string" && data.csrf_token ? data.csrf_token : null;
      csrfTokenRef.current = token;
      return token;
    } catch {
      return null;
    }
  }, [AUTH_SERVICE_URL]);

  /**
   * Rafraîchit la session : échange le cookie refresh contre un nouvel access token, puis
   * recharge le profil via /auth/userinfo. En cas d'échec, purge l'état d'auth et retourne null.
   */
  const refresh = useCallback((): Promise<string | null> => {
    // Fusionne les appels concurrents sur une unique requête en vol (voir refreshInFlightRef).
    if (refreshInFlightRef.current) return refreshInFlightRef.current;

    const run = async (): Promise<string | null> => {
      try {
        // Un refresh mute l'état côté serveur → nécessite un jeton CSRF (récupéré si absent).
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

        // Refresh rejeté (cookie absent/expiré/révoqué) : on repart d'un état non authentifié.
        if (!res.ok) {
          accessTokenRef.current = null;
          csrfTokenRef.current = null;
          setUser(null);
          return null;
        }

        const data = await res.json();
        accessTokenRef.current = data.access_token;
        // Le serveur peut faire tourner le jeton CSRF à chaque refresh — on adopte le nouveau.
        if (typeof data.csrf_token === "string") csrfTokenRef.current = data.csrf_token;

        // Recharge le profil avec le token frais ; un échec ici ne casse pas la session
        // (l'access token reste valide), on garde simplement l'ancien `user`.
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

    // On mémorise la promesse en vol puis on la libère quoi qu'il arrive, pour que les
    // refresh suivants repartent d'une requête neuve.
    const promise = run().finally(() => {
      refreshInFlightRef.current = null;
    });
    refreshInFlightRef.current = promise;
    return promise;
  }, [AUTH_SERVICE_URL, bootstrapCsrf]);

  /**
   * Connexion par email/mot de passe. En cas de second facteur requis (HTTP 202), lève une
   * LoginChallengeError pour signaler à l'appelant de rediriger vers la page de login hébergée.
   */
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
      // 202 : identifiants valides mais un second facteur reste à fournir. Aucun token n'est
      // émis ici — on signale à l'appelant de router vers la page de login hébergée, qui
      // orchestre la cérémonie (enrôlement si demandé, sinon vérification).
      if (res.status === 202) {
        throw new LoginChallengeError(data.enrollment_required ? "enrollment" : "mfa");
      }
      accessTokenRef.current = data.access_token;
      if (typeof data.csrf_token === "string") csrfTokenRef.current = data.csrf_token;
      setUser(data.user);
    },
    [AUTH_SERVICE_URL],
  );

  /**
   * Déconnexion : révoque la session côté serveur puis purge inconditionnellement l'état
   * local (le `finally` garantit un état propre même si l'appel réseau échoue).
   */
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

  // Amorçage de session au montage. Deux sources possibles :
  //  1. Un token passé dans l'URL (l'auth-service redirige vers `?access_token=…` après login) :
  //     on l'adopte, on charge le profil, puis on retire le paramètre de l'URL. Consommer ce
  //     token fait qu'un chargement direct / deep link arrive authentifié au lieu de rebondir
  //     vers le formulaire de login ; le retirer garde le token hors de l'historique, des
  //     en-têtes Referer et des logs serveur.
  //  2. Sinon (ou si le token d'URL est périmé) : refresh silencieux via le cookie.
  // `setIsLoading(false)` est appelé au final, quel que soit le chemin, pour débloquer le rendu.
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
          // Token d'URL périmé/invalide — on retombe sur le cookie de refresh.
          accessTokenRef.current = null;
          await refresh();
        }
      } finally {
        // Nettoie l'URL dans tous les cas (succès comme échec).
        url.searchParams.delete("access_token");
        window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
      }
    };

    boot().finally(() => setIsLoading(false));
  }, [refresh, AUTH_SERVICE_URL]);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      // Dérivé de l'état réactif, pas de la ref token : une mise à jour de ref ne déclenche
      // jamais de re-render, donc `isAuthenticated` ne se recalculerait qu'incidemment.
      // `setUser` accompagne chaque changement de token (posé au login/refresh, effacé au logout).
      isAuthenticated: !!user,
      isLoading,
      authServiceUrl,
      login,
      logout,
      refresh,
      getAccessToken,
    }),
    [user, isLoading, authServiceUrl, login, logout, refresh, getAccessToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Accès au contexte d'auth. Lève si appelé hors d'un `AuthProvider` (garde-fou de câblage).
 */
export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
