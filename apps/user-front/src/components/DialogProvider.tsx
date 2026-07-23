import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useFocusTrap } from "../lib/useFocusTrap";
import { DialogContext, type AlertOptions, type ConfirmOptions } from "./dialog-context";

// État du dialogue affiché : les options passées + le mode (confirmation ou simple alerte).
interface DialogState extends ConfirmOptions {
  mode: "confirm" | "alert";
}

/**
 * Provider React remplaçant window.confirm / window.alert par des dialogues thémés.
 *
 * Expose via le contexte une API impérative basée sur des Promises pour que les appels
 * se lisent comme leurs équivalents natifs :
 *   if (!(await confirm({ message }))) return;
 *
 * `confirm` résout un booléen (true = confirmé) ; `alert` résout void à la fermeture.
 */
export function DialogProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [state, setState] = useState<DialogState | null>(null);
  // Résolveur de la Promise en cours, mémorisé dans un ref pour être appelé à la fermeture.
  const resolverRef = useRef<((v: boolean) => void) | null>(null);

  // Ferme le dialogue et résout la Promise en attente avec le résultat donné.
  const settle = useCallback((result: boolean) => {
    setState(null);
    resolverRef.current?.(result);
    resolverRef.current = null;
  }, []);

  const confirm = useCallback(
    (opts: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        resolverRef.current = resolve;
        setState({ mode: "confirm", ...opts });
      }),
    [],
  );

  const alert = useCallback(
    (opts: AlertOptions) =>
      new Promise<void>((resolve) => {
        resolverRef.current = () => resolve();
        setState({ mode: "alert", ...opts });
      }),
    [],
  );

  // Échap annule (interprété comme un « non » / rejet).
  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") settle(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [state, settle]);

  const panelRef = useFocusTrap<HTMLDivElement>(!!state);
  const danger = state?.tone === "danger";
  const isConfirm = state?.mode === "confirm";
  // Pour une confirmation destructive, on met le focus sur l'action sûre (annuler) plutôt
  // que sur l'action destructive, afin qu'un appui accidentel sur Entrée ne la déclenche pas.
  const focusDestructive = !(isConfirm && danger);

  const value = useMemo(() => ({ confirm, alert }), [confirm, alert]);

  return (
    <DialogContext.Provider value={value}>
      {children}
      {state && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby={state.title ? "dialog-title" : "dialog-desc"}
          aria-describedby="dialog-desc"
        >
          <button
            aria-label={t("common.cancel")}
            onClick={() => settle(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div
            ref={panelRef}
            tabIndex={-1}
            className="relative w-full max-w-sm rounded-t-2xl bg-base-100 p-5 shadow-2xl outline-none sm:rounded-2xl"
          >
            {state.title && (
              <h2 id="dialog-title" className="text-lg font-bold text-base-content">
                {state.title}
              </h2>
            )}
            <p id="dialog-desc" className="mt-1 text-sm text-base-content/70">
              {state.message}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              {isConfirm && (
                <button autoFocus={!focusDestructive} onClick={() => settle(false)} className="btn btn-soft">
                  {state.cancelLabel ?? t("common.cancel")}
                </button>
              )}
              <button
                autoFocus={focusDestructive}
                onClick={() => settle(true)}
                className={`btn ${danger ? "btn-error" : "btn-primary"}`}
              >
                {state.confirmLabel ?? (isConfirm ? t("common.confirm") : t("common.ok"))}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}
