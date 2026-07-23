/**
 * Contexte React des boîtes de dialogue impératives (confirm / alert).
 *
 * Définit le contrat (types d'options + valeur du contexte) et le hook `useDialog`
 * consommé par les composants. Le provider qui remplit ce contexte est défini
 * ailleurs.
 */
import { createContext, useContext } from "react";

// Ton visuel de la boîte : neutre par défaut, ou rouge pour une action destructive.
type Tone = "default" | "danger";

/** Options d'une boîte de confirmation (bouton OK + bouton Annuler). */
export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: Tone;
}

/** Options d'une simple alerte : un confirm sans bouton d'annulation. */
export type AlertOptions = Omit<ConfirmOptions, "cancelLabel">;

/** Valeur exposée par le contexte : deux ouvertures de dialogue basées sur des promesses. */
export interface DialogContextValue {
  // Résout à true si confirmé, false si annulé.
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  // Résout une fois l'alerte fermée.
  alert: (opts: AlertOptions) => Promise<void>;
}

export const DialogContext = createContext<DialogContextValue | null>(null);

/** Accès au contexte des dialogues ; lève si utilisé hors d'un DialogProvider. */
export function useDialog(): DialogContextValue {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useDialog must be used within a DialogProvider");
  return ctx;
}
