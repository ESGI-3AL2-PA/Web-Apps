import { useEffect, type ReactNode } from "react";
import { AuthProvider, useAuth } from "@repo/hooks";
import { setupInterceptors } from "../api-service/api";

const AUTH_SERVICE_URL = import.meta.env.VITE_AUTH_SERVICE_URL ?? "http://localhost:6000";

function InterceptorSetup({ children }: { children: ReactNode }) {
  const { getAccessToken, refresh } = useAuth();

  useEffect(() => {
    setupInterceptors(getAccessToken, refresh);
  }, [getAccessToken, refresh]);

  return <>{children}</>;
}

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider authServiceUrl={AUTH_SERVICE_URL}>
      <InterceptorSetup>
        {children}
      </InterceptorSetup>
    </AuthProvider>
  );
}
