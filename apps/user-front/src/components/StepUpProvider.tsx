import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useAuth, TotpCodeInput, TOTP_CODE_LENGTH } from "@repo/hooks";
import { fetchStepUpToken } from "../api-service/step-up.service";
import { setStepUpHandler } from "../api-service/api";
import { useFocusTrap } from "../lib/useFocusTrap";
import { StepUpContext } from "./step-up-context";

/**
 * Composant React (provider) : re-confirmation par TOTP frais pour les opérations
 * sensibles.
 *
 * Expose un `requestStepUp()` impératif qui ouvre une modale de saisie de code à
 * 6 chiffres et résout vers un step-up token. S'enregistre aussi comme handler de
 * l'intercepteur api : tout appel sensible qui reçoit un 401 `{ code: "step_up_required" }`
 * déclenche la modale et rejoue la requête de façon transparente. Ne se manifeste
 * qu'en production — en dev, le backend n'exige jamais de step-up, donc la modale
 * n'apparaît pas.
 */
export function StepUpProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { getAccessToken, refresh } = useAuth();

  const resolverRef = useRef<{ resolve: (token: string) => void; reject: (err: Error) => void } | null>(null);
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ouvre la modale et renvoie une promesse ; on stocke resolve/reject dans un ref
  // pour les déclencher plus tard depuis submit/cancel.
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

  // L'intercepteur api vit hors de React ; on lui passe un callback qui convertit une
  // annulation en null, afin qu'un refus laisse simplement le 401 d'origine se propager.
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

  // Valide le code : récupère un access token frais (refresh si besoin), échange
  // token + code contre un step-up token, puis résout la promesse en attente.
  const submit = useCallback(async () => {
    if (code.length !== TOTP_CODE_LENGTH) return;
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

  // Échap annule la saisie.
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
              <TotpCodeInput autoFocus value={code} onChange={setCode} onSubmit={submit} />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={cancel} disabled={busy} className="btn btn-soft">
                {t("common.cancel")}
              </button>
              <button onClick={submit} disabled={busy || code.length !== TOTP_CODE_LENGTH} className="btn btn-primary">
                {t("stepUp.verify")}
              </button>
            </div>
          </div>
        </div>
      )}
    </StepUpContext.Provider>
  );
}
