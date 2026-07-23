import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@repo/hooks";
import { checkApiHealth } from "../api-service/health";
import ServerError from "../pages/ServerError";

/**
 * Composant garde (wrapper) : une fois l'utilisateur authentifié, vérifie que l'api
 * est joignable avant de rendre l'application.
 *
 * Pendant la vérification, on bloque sur un loader (pour ne pas laisser apparaître une
 * appli qui échouerait à chaque requête) ; si l'api est injoignable on affiche la page 500
 * (avec un bouton pour réessayer) à la place des enfants.
 */
export default function ApiHealthGuard({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [status, setStatus] = useState<"checking" | "ok" | "down">("checking");
  const [retrying, setRetrying] = useState(false);

  // Interroge l'endpoint de santé de l'api et met à jour le statut ("ok" / "down").
  const check = useCallback(async () => {
    const ok = await checkApiHealth();
    setStatus(ok ? "ok" : "down");
    return ok;
  }, []);

  // Relance la vérification dès que l'authentification est résolue et l'utilisateur connecté.
  useEffect(() => {
    if (isLoading || !isAuthenticated) return;
    setStatus("checking");
    void check();
  }, [isLoading, isAuthenticated, check]);

  const retry = useCallback(async () => {
    setRetrying(true);
    try {
      await check();
    } finally {
      setRetrying(false);
    }
  }, [check]);

  // Auth encore en cours de résolution ou utilisateur déconnecté → on laisse
  // AuthProvider / ProtectedRoute gérer le cas (pas de vérification de santé ici).
  if (isLoading || !isAuthenticated) return <>{children}</>;
  if (status === "down") return <ServerError onRetry={retry} retrying={retrying} />;
  if (status === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base-100">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }
  return <>{children}</>;
}
