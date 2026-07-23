// Composant : provider de « step-up » (re-confirmation TOTP fraîche) pour les
// opérations admin sensibles. Fournit le contexte StepUpContext au reste de l'app.
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useAuth, TotpCodeInput, TOTP_CODE_LENGTH } from "@repo/hooks";
import { fetchStepUpToken } from "../api-service/step-up";
import { setStepUpHandler } from "../api-service/api";
import { FormModal } from "./FormModal";
import { StepUpContext } from "./step-up-context";

/**
 * Re-confirmation TOTP fraîche pour les opérations admin sensibles. Expose un
 * `requestStepUp()` impératif (renvoie une Promise résolue avec le step-up token)
 * et s'enregistre comme handler de l'intercepteur api : tout appel sensible qui
 * reçoit un 401 { code: "step_up_required" } déclenche la modale puis rejoue la requête.
 * N'intervient qu'en production — en dev le backend n'exige jamais de step-up.
 */
export function StepUpProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { getAccessToken, refresh } = useAuth();

  // Conserve les callbacks resolve/reject de la Promise en attente pendant que la modale est ouverte.
  const resolverRef = useRef<{ resolve: (token: string) => void; reject: (err: Error) => void } | null>(null);
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ouvre la modale et renvoie une Promise résolue au submit (token) ou rejetée à l'annulation.
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

  // Branche/débranche ce provider comme handler de step-up de l'intercepteur api.
  // Un rejet (annulation) est ramené à null pour que l'appel d'origine échoue proprement.
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

  // Vérifie le code TOTP : échange (access token + code) contre un step-up token et résout la Promise.
  const submit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (code.length !== TOTP_CODE_LENGTH) return;
      setBusy(true);
      setError(null);
      try {
        // Token courant, ou refresh si expiré, avant d'appeler l'échange step-up.
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
            <TotpCodeInput autoFocus value={code} onChange={setCode} />
          </label>
        </FormModal>
      )}
    </StepUpContext.Provider>
  );
}
