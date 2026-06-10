import { type ReactNode } from "react";
import { useAuth } from "./useAuth";

interface ProtectedRouteProps {
  children: ReactNode;
  roles?: string[];
}

export function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user, authServiceUrl } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated) {
    window.location.href = `${authServiceUrl}/login?redirect_uri=${encodeURIComponent(window.location.href)}`;
    return null;
  }

  if (roles) {
    // Authenticated but identity not yet resolved — wait rather than flash content.
    if (!user) return null;
    if (!roles.includes(user.role)) {
      return (
        <div style={{ padding: "2rem", textAlign: "center" }}>
          <h1>403 — Forbidden</h1>
          <p>You do not have permission to access this page.</p>
        </div>
      );
    }
  }

  return <>{children}</>;
}
