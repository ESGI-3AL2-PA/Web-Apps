// Contexte React partageant le mécanisme de « step-up » (ré-authentification forte) :
// avant une action sensible, on redemande un code TOTP frais qui produit un token de step-up.
// Expose le contexte, son type de valeur et le hook d'accès `useStepUp`.
import { createContext, useContext } from "react";

export interface StepUpContextValue {
  /** Demande un nouveau code TOTP à l'utilisateur et résout vers un token de step-up ; rejette si annulé. */
  requestStepUp: () => Promise<string>;
}

export const StepUpContext = createContext<StepUpContextValue | null>(null);

/** Accède au contexte de step-up ; lève une erreur si utilisé hors d'un StepUpProvider. */
export function useStepUp(): StepUpContextValue {
  const ctx = useContext(StepUpContext);
  if (!ctx) throw new Error("useStepUp must be used within a StepUpProvider");
  return ctx;
}
