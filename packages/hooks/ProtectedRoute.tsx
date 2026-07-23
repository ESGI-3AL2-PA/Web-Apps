// Garde de route pour les fronts React : bloque le rendu des enfants tant que
// l'authentification n'est pas résolue, redirige les visiteurs non connectés vers la page
// de login de l'auth-service, et applique un contrôle de rôle optionnel (403 ou redirection).
import { useEffect, type ReactNode } from "react";
import { useAuth } from "./useAuth";

interface ProtectedRouteProps {
  children: ReactNode;
  /** Rôles autorisés. Absent → simple exigence d'être authentifié, sans filtrage de rôle. */
  roles?: string[];
  /** Si défini, un rôle qui échoue au contrôle `roles` est redirigé ici au lieu de voir la page 403. */
  forbiddenRedirect?: string;
}

// Styles inline neutres (indépendants de tout framework CSS) : ce composant est partagé entre
// des fronts qui ne partagent pas de framework CSS, il ne peut donc pas supposer la présence
// des classes Tailwind/flyonui.
const center: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "1rem",
  textAlign: "center",
  fontFamily: "system-ui, sans-serif",
};

// Indicateur de chargement autonome : keyframes de rotation injectées inline pour rester
// affichable sans feuille de style externe.
function Spinner() {
  return (
    <div style={center} role="status" aria-label="Loading">
      <style>{`@keyframes pr-spin{to{transform:rotate(360deg)}}`}</style>
      <div
        style={{
          width: 40,
          height: 40,
          border: "4px solid rgba(0,0,0,0.1)",
          borderTopColor: "#4f46e5",
          borderRadius: "50%",
          animation: "pr-spin 0.8s linear infinite",
        }}
      />
    </div>
  );
}

/**
 * Enveloppe une sous-arborescence protégée.
 *
 * - Pendant la résolution de l'auth (`isLoading`), affiche un spinner.
 * - Non authentifié → redirige vers `${authServiceUrl}/login`, avec l'URL courante en
 *   `redirect_uri` pour revenir après connexion.
 * - Si `roles` est fourni et que le rôle de l'utilisateur n'y figure pas : redirige vers
 *   `forbiddenRedirect` si présent, sinon rend une page 403 avec bouton de déconnexion.
 */
export function ProtectedRoute({ children, roles, forbiddenRedirect }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user, authServiceUrl, logout } = useAuth();

  // Conditions dérivées, calculées uniquement une fois l'auth résolue (!isLoading).
  const needsLogin = !isLoading && !isAuthenticated;
  const redirectForbidden =
    !isLoading && isAuthenticated && !!roles && !!user && !roles.includes(user.role) && !!forbiddenRedirect;

  // On navigue dans un effet, pas dans le corps du rendu : affecter window.location.href
  // pendant le rendu est un effet de bord (et se déclenche deux fois sous StrictMode).
  useEffect(() => {
    if (needsLogin) {
      window.location.href = `${authServiceUrl}/login?redirect_uri=${encodeURIComponent(window.location.href)}`;
    }
  }, [needsLogin, authServiceUrl]);

  useEffect(() => {
    if (redirectForbidden) {
      window.location.href = forbiddenRedirect!;
    }
  }, [redirectForbidden, forbiddenRedirect]);

  if (isLoading) {
    return <Spinner />;
  }

  if (!isAuthenticated) {
    return <Spinner />;
  }

  if (roles) {
    // Authentifié mais identité pas encore chargée — on attend plutôt que de laisser
    // clignoter le contenu protégé.
    if (!user) return <Spinner />;
    if (!roles.includes(user.role)) {
      // Rôle interdit : un spinner le temps que l'effet ci-dessus effectue la redirection.
      if (forbiddenRedirect) {
        return <Spinner />;
      }
      return (
        <div style={center}>
          <h1 style={{ fontSize: "1.5rem", margin: 0 }}>403 — Forbidden</h1>
          <p style={{ color: "#6b7280", margin: 0 }}>You do not have permission to access this page.</p>
          <button
            onClick={() => logout()}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "0.5rem",
              border: "none",
              background: "#4f46e5",
              color: "#fff",
              cursor: "pointer",
              fontSize: "0.875rem",
            }}
          >
            Sign out
          </button>
        </div>
      );
    }
  }

  return <>{children}</>;
}
