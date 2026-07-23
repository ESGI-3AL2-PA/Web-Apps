import { useEffect, type ReactNode } from "react";
import { AuthProvider, useAuth } from "@repo/hooks";
import { config } from "@repo/config";
import { setupInterceptors } from "../api-service/api";
import { SocketProvider } from "../sockets/SocketProvider";
import { DialogProvider } from "../components/DialogProvider";
import { StepUpProvider } from "../components/StepUpProvider";
import ApiHealthGuard from "../components/ApiHealthGuard";

const AUTH_SERVICE_URL = config.authServiceUrl;

/**
 * Branche les intercepteurs axios sur les fonctions d'auth vivantes. Doit être placé
 * SOUS AuthProvider pour disposer de `getAccessToken`/`refresh` : les intercepteurs
 * attachent le Bearer aux requêtes et déclenchent le refresh sur 401.
 */
function InterceptorSetup({ children }: { children: ReactNode }) {
  const { getAccessToken, refresh } = useAuth();

  useEffect(() => {
    setupInterceptors(getAccessToken, refresh);
  }, [getAccessToken, refresh]);

  return <>{children}</>;
}

/**
 * Empile tous les providers transverses de l'app, dans l'ordre où ils dépendent
 * les uns des autres : auth → intercepteurs → garde de santé de l'api → socket temps
 * réel → step-up (ré-auth) → dialogues. L'imbrication reflète ces dépendances.
 */
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
