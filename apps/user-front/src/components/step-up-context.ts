/**
 * Contexte React du step-up (re-confirmation par TOTP).
 *
 * Définit le contrat et le hook `useStepUp` ; le provider est `StepUpProvider`.
 */
import { createContext, useContext } from "react";

export interface StepUpContextValue {
  /** Demande un code TOTP frais et résout vers un step-up token ; rejette si annulé. */
  requestStepUp: () => Promise<string>;
}

export const StepUpContext = createContext<StepUpContextValue | null>(null);

/** Accès au contexte de step-up ; lève si utilisé hors d'un StepUpProvider. */
export function useStepUp(): StepUpContextValue {
  const ctx = useContext(StepUpContext);
  if (!ctx) throw new Error("useStepUp must be used within a StepUpProvider");
  return ctx;
}
