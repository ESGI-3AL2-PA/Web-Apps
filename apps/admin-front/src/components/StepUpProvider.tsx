import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@repo/hooks";
import { fetchStepUpToken } from "../api-service/step-up";
import { setStepUpHandler } from "../api-service/api";
import { FormModal } from "./FormModal";
import { StepUpContext } from "./step-up-context";

// Fresh-TOTP re-confirmation for sensitive admin operations. Exposes an imperative
// `requestStepUp()` and registers itself as the api interceptor's handler, so any sensitive
// api call that gets 401 { code: "step_up_required" } transparently prompts and retries.
// Only fires in production — in dev the backend never demands step-up.
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

  const submit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (code.length !== 6) return;
      setBusy(true);
      setError(null);
      try {
        const tok = getAccessToken() ?? (await refresh());
        if (!tok) throw new Error(t("stepUp.error"));
        const stepUpToken = await fetchStepUpToken(tok, code);
        resolverRef.current?.resolve(stepUpToken);
        close();
      } catch (err) {
        setError((err as Error).message || t("stepUp.invalid"));
      } finally {
        setBusy(false);
      }
    },
    [code, getAccessToken, refresh, t, close],
  );

  const value = useMemo(() => ({ requestStepUp }), [requestStepUp]);

  return (
    <StepUpContext.Provider value={value}>
      {children}
      {open && (
        <FormModal
          open
          title={t("stepUp.title")}
          onClose={cancel}
          onSubmit={submit}
          submitLabel={t("stepUp.verify")}
          submitting={busy}
          error={error}
        >
          <p className="text-sm text-base-content/70">{t("stepUp.desc")}</p>
          <label className="block text-sm font-medium">
            {t("stepUp.codeLabel")}
            <input
              autoFocus
              inputMode="numeric"
              maxLength={6}
              className="input mt-1 w-40 tracking-[0.3em]"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
            />
          </label>
        </FormModal>
      )}
    </StepUpContext.Provider>
  );
}
