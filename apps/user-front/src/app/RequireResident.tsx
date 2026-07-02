import { useEffect, type ReactNode } from "react";
import { useAuth } from "@repo/hooks";
import { config } from "@repo/config";

// superAdmin has no place on the user front — send it straight to the admin front. Runs inside
// ProtectedRoute, so the user is already authenticated and resolved by the time this renders.
export default function RequireResident({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "superAdmin";

  useEffect(() => {
    if (isSuperAdmin) {
      window.location.replace(config.adminUrl);
    }
  }, [isSuperAdmin]);

  if (isSuperAdmin) return null;

  return <>{children}</>;
}
