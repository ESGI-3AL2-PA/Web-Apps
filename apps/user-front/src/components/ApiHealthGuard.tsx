import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@repo/hooks";
import { checkApiHealth } from "../api-service/health";
import ServerError from "../pages/ServerError";

// After login, verify the api is reachable. If it's down, show a 500 page instead of
// an app that silently fails every request. Renders children optimistically while
// checking; a connection failure resolves near-instantly.
export default function ApiHealthGuard({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [down, setDown] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const check = useCallback(async () => {
    const ok = await checkApiHealth();
    setDown(!ok);
    return ok;
  }, []);

  useEffect(() => {
    if (isLoading || !isAuthenticated) return;
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

  if (down) return <ServerError onRetry={retry} retrying={retrying} />;
  return <>{children}</>;
}
