import { createContext, useContext } from "react";

export interface StepUpContextValue {
  /** Prompt for a fresh TOTP code and resolve to a step-up token; rejects if cancelled. */
  requestStepUp: () => Promise<string>;
}

export const StepUpContext = createContext<StepUpContextValue | null>(null);

export function useStepUp(): StepUpContextValue {
  const ctx = useContext(StepUpContext);
  if (!ctx) throw new Error("useStepUp must be used within a StepUpProvider");
  return ctx;
}
