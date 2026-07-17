import type { ReactNode } from "react";
import { useAuth } from "@repo/hooks";
import NoDistrict from "../pages/NoDistrict";

// Gates the app on district membership — but only for regular users. A user with no
// districtId can't use the app and sees the access-denied wall (NoDistrict). Admins have
// no districtId of their own (they operate via adminDistrictId) so they are never gated;
// superAdmins are already redirected to the admin console by the outer ProtectedRoute and
// never reach here.
export function DistrictGuard({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  if (user?.role === "user" && !user.districtId) {
    return <NoDistrict />;
  }
  return <>{children}</>;
}
