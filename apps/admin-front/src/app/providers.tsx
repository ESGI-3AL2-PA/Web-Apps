// Composition racine des providers de la console admin : auth, interceptors axios, toasts, step-up.
import { useEffect, type ReactNode } from "react";
import { AuthProvider, useAuth } from "@repo/hooks";
import { config } from "@repo/config";
import { setupInterceptors } from "../api-service/api";
import { ToastProvider } from "../components/Toast";
import { StepUpProvider } from "../components/StepUpProvider";

const AUTH_SERVICE_URL = config.authServiceUrl;

/**
 * Câble les interceptors axios une fois l'auth disponible : injecte le Bearer token et déclenche
 * le refresh sur 401. Doit être un enfant d'AuthProvider pour accéder à `useAuth`.
 */
function InterceptorSetup({ children }: { children: ReactNode }) {
  const { getAccessToken, refresh } = useAuth();

  useEffect(() => {
    setupInterceptors(getAccessToken, refresh);
  }, [getAccessToken, refresh]);

  return <>{children}</>;
}

/** Enveloppe l'application avec tous les providers globaux, dans le bon ordre d'imbrication. */
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
