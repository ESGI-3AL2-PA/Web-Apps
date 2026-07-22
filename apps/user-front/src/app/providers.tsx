import { useEffect, type ReactNode } from "react";
import { AuthProvider, useAuth } from "@repo/hooks";
import { config } from "@repo/config";
import { setupInterceptors } from "../api-service/api";
import { SocketProvider } from "../sockets/SocketProvider";
import { DialogProvider } from "../components/DialogProvider";
import { StepUpProvider } from "../components/StepUpProvider";
import ApiHealthGuard from "../components/ApiHealthGuard";

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
        <ApiHealthGuard>
          <SocketProvider>
            <StepUpProvider>
              <DialogProvider>{children}</DialogProvider>
            </StepUpProvider>
          </SocketProvider>
        </ApiHealthGuard>
      </InterceptorSetup>
    </AuthProvider>
  );
}
