import { type ReactNode } from "react";
import { useAuth } from "./useAuth";

interface ProtectedRouteProps {
  children: ReactNode;
  roles?: string[];
}

// Framework-neutral inline styles: this component is shared across fronts that don't share a CSS
// framework, so it can't rely on Tailwind/flyonui classes being present.
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

export function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user, authServiceUrl, logout } = useAuth();

  if (isLoading) {
    return <Spinner />;
  }

  if (!isAuthenticated) {
    window.location.href = `${authServiceUrl}/login?redirect_uri=${encodeURIComponent(window.location.href)}`;
    return <Spinner />;
  }

  if (roles) {
    // Authenticated but identity not yet resolved — wait rather than flash content.
    if (!user) return <Spinner />;
    if (!roles.includes(user.role)) {
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
