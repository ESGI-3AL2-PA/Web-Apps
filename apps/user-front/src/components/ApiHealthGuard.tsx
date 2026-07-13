import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@repo/hooks";
import { checkApiHealth } from "../api-service/health";
import ServerError from "../pages/ServerError";

// After login, verify the api is reachable before rendering the app. While the
// check is in flight we block on a loader (no flash of an app that would fail every
// request); if the api is down we show a 500 page instead.
export default function ApiHealthGuard({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [status, setStatus] = useState<"checking" | "ok" | "down">("checking");
  const [retrying, setRetrying] = useState(false);

  const check = useCallback(async () => {
    const ok = await checkApiHealth();
    setStatus(ok ? "ok" : "down");
    return ok;
  }, []);

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

  // Auth still resolving or logged out → let AuthProvider / ProtectedRoute handle it.
  if (isLoading || !isAuthenticated) return <>{children}</>;
  if (status === "down") return <ServerError onRetry={retry} retrying={retrying} />;
  if (status === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[color:var(--color-canvas)]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-[color:var(--color-brand)]" />
      </div>
    );
  }
  return <>{children}</>;
}
