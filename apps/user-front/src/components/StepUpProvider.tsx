import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@repo/hooks";
import { fetchStepUpToken } from "../api-service/step-up.service";
import { setStepUpHandler } from "../api-service/api";
import { useFocusTrap } from "../lib/useFocusTrap";
import { StepUpContext } from "./step-up-context";

// Fresh-TOTP re-confirmation for sensitive operations. Exposes an imperative
// `requestStepUp()` that opens a 6-digit code modal and resolves to a step-up token.
// Also registered as the api interceptor's handler, so any sensitive api call that gets
// 401 { code: "step_up_required" } transparently prompts and retries. Only fires in
// production — in dev the backend never demands step-up, so the modal never appears.
export function StepUpProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { getAccessToken, refresh } = useAuth();

  const resolverRef = useRef<{ resolve: (token: string) => void; reject: (err: Error) => void } | null>(null);
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestStepUp = useCallback(
    () =>
      new Promise<string>((resolve, reject) => {
        resolverRef.current = { resolve, reject };
        setCode("");
        setError(null);
        setBusy(false);
        setOpen(true);
      }),
    [],
  );

  // The api interceptor lives outside React; hand it a callback that swallows a cancel
  // into null so a rejected prompt just lets the original 401 propagate.
  useEffect(() => {
    setStepUpHandler(() => requestStepUp().catch(() => null));
    return () => setStepUpHandler(null);
  }, [requestStepUp]);

  const close = useCallback(() => {
    setOpen(false);
    resolverRef.current = null;
  }, []);

  const cancel = useCallback(() => {
    resolverRef.current?.reject(new Error("step-up cancelled"));
    close();
  }, [close]);

  const submit = useCallback(async () => {
    if (code.length !== 6) return;
    setBusy(true);
    setError(null);
    try {
      const tok = getAccessToken() ?? (await refresh());
      if (!tok) throw new Error(t("stepUp.error"));
      const stepUpToken = await fetchStepUpToken(tok, code);
      resolverRef.current?.resolve(stepUpToken);
      close();
    } catch (e) {
      setError((e as Error).message || t("stepUp.invalid"));
    } finally {
      setBusy(false);
    }
  }, [code, getAccessToken, refresh, t, close]);

  // Escape cancels.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, cancel]);

  const panelRef = useFocusTrap<HTMLDivElement>(open);
  const value = useMemo(() => ({ requestStepUp }), [requestStepUp]);

  return (
    <StepUpContext.Provider value={value}>
      {children}
      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="step-up-title"
        >
          <button aria-label={t("common.cancel")} onClick={cancel} className="absolute inset-0 bg-black/40" />
          <div
            ref={panelRef}
            tabIndex={-1}
            className="relative w-full max-w-sm rounded-t-2xl bg-base-100 p-5 shadow-2xl outline-none sm:rounded-2xl"
          >
            <h2 id="step-up-title" className="flex items-center gap-2 text-lg font-bold text-base-content">
              <span className="icon-[tabler--shield-lock] size-5 text-primary" />
              {t("stepUp.title")}
            </h2>
            <p className="mt-1 text-sm text-base-content/70">{t("stepUp.desc")}</p>
            {error && (
              <p role="alert" className="mt-3 text-sm text-error">
                {error}
              </p>
            )}
            <label className="mt-4 block text-sm font-medium">
              {t("stepUp.codeLabel")}
              <input
                autoFocus
                inputMode="numeric"
                maxLength={6}
                className="input mt-1 w-40 tracking-[0.3em]"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                }}
                placeholder="000000"
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={cancel} disabled={busy} className="btn btn-soft">
                {t("common.cancel")}
              </button>
              <button onClick={submit} disabled={busy || code.length !== 6} className="btn btn-primary">
                {t("stepUp.verify")}
              </button>
            </div>
          </div>
        </div>
      )}
    </StepUpContext.Provider>
  );
}
