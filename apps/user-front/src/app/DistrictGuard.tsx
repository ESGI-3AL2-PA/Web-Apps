import type { ReactNode } from "react";
import { useAuth } from "@repo/hooks";
import NoDistrict from "../pages/NoDistrict";

/**
 * Garde d'accès conditionnant l'app à l'appartenance à un quartier — mais uniquement
 * pour les utilisateurs standards. Un `user` sans `districtId` ne peut rien faire et
 * voit le mur d'accès refusé (NoDistrict).
 *
 * Les administrateurs n'ont pas de `districtId` propre (ils opèrent via `adminDistrictId`)
 * et ne sont donc jamais bloqués ; les superAdmins sont redirigés vers la console admin
 * par le `ProtectedRoute` parent et n'atteignent jamais ce composant.
 */
export function DistrictGuard({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  // Seuls les rôles "user" sont soumis à la condition ; les autres passent librement.
  if (user?.role === "user" && !user.districtId) {
    return <NoDistrict />;
  }
  return <>{children}</>;
}
