import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

type Tone = "default" | "danger";

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: Tone;
}

type AlertOptions = Omit<ConfirmOptions, "cancelLabel">;

interface DialogState extends ConfirmOptions {
  mode: "confirm" | "alert";
}

interface DialogContextValue {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  alert: (opts: AlertOptions) => Promise<void>;
}

const DialogContext = createContext<DialogContextValue | null>(null);

// App-themed replacement for window.confirm / window.alert. Exposes an imperative,
// promise-based API so call sites read like the native ones they replace:
//   if (!(await confirm({ message }))) return;
export function DialogProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [state, setState] = useState<DialogState | null>(null);
  const resolverRef = useRef<((v: boolean) => void) | null>(null);

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

  // Escape cancels (treated as a "no" / dismiss).
  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") settle(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [state, settle]);

  const danger = state?.tone === "danger";
  const isConfirm = state?.mode === "confirm";
  // For a destructive confirm, focus the safe (cancel) action instead of the
  // destructive one so a stray Enter doesn't trigger it.
  const focusDestructive = !(isConfirm && danger);

  return (
    <DialogContext.Provider value={{ confirm, alert }}>
      {children}
      {state && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center"
          role="dialog"
          aria-modal="true"
        >
          <button
            aria-label={t("common.cancel")}
            onClick={() => settle(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="relative w-full max-w-sm rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl">
            {state.title && <h2 className="text-lg font-bold text-neutral-900">{state.title}</h2>}
            <p className="mt-1 text-sm text-neutral-600">{state.message}</p>
            <div className="mt-5 flex justify-end gap-2">
              {isConfirm && (
                <button
                  autoFocus={!focusDestructive}
                  onClick={() => settle(false)}
                  className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
                >
                  {state.cancelLabel ?? t("common.cancel")}
                </button>
              )}
              <button
                autoFocus={focusDestructive}
                onClick={() => settle(true)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold text-white ${
                  danger
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-[color:var(--color-brand)] hover:bg-[color:var(--color-brand-dark)]"
                }`}
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

export function useDialog(): DialogContextValue {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useDialog must be used within a DialogProvider");
  return ctx;
}
