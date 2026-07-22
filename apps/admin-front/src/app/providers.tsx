import { useEffect, type ReactNode } from "react";
import { AuthProvider, useAuth } from "@repo/hooks";
import { config } from "@repo/config";
import { setupInterceptors } from "../api-service/api";
import { ToastProvider } from "../components/Toast";
import { StepUpProvider } from "../components/StepUpProvider";

const AUTH_SERVICE_URL = config.authServiceUrl;

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
        <ToastProvider>
          <StepUpProvider>{children}</StepUpProvider>
        </ToastProvider>
      </InterceptorSetup>
    </AuthProvider>
  );
}
