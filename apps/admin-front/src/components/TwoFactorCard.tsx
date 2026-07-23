// Composant : carte de gestion de la double authentification (TOTP) d'un admin.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { TotpCodeInput, TOTP_CODE_LENGTH } from "@repo/hooks";
import { confirmTotp, disableTotp, enrollTotp, StepUpRequiredError } from "../api-service/totp";
import { useStepUp } from "./step-up-context";

/**
 * Gestion de l'enrôlement TOTP pour les admins :
 *  - activer = enroll → affiche secret + URL otpauth → confirme un code à 6 chiffres ;
 *  - désactiver = ressaisit le mot de passe (plus un code step-up en production).
 * Miroir du TwoFactorCard de user-front ; les endpoints d'auth vivent sur l'auth-service (service totp).
 * @param token  Fournit un access token frais (peut renvoyer null si indisponible).
 * @param initialEnabled  État TOTP initial du compte (activé ou non).
 */
export function TwoFactorCard({
  token,
  initialEnabled,
}: {
  token: () => Promise<string | null>;
  initialEnabled: boolean;
}) {
  const { t } = useTranslation();
  const { requestStepUp } = useStepUp();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [enroll, setEnroll] = useState<{ secret: string; url: string } | null>(null);
  const [code, setCode] = useState("");
  const [disarming, setDisarming] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Enveloppe commune : récupère un token frais, gère busy/error autour de l'appel fourni.
  const withTok = async (fn: (tok: string) => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      const tok = await token();
      if (!tok) throw new Error(t("security.twoFactor.error"));
      await fn(tok);
    } catch (e) {
      setError((e as Error).message || t("security.twoFactor.error"));
    } finally {
      setBusy(false);
    }
  };

  // Démarre l'enrôlement : récupère le secret + l'URL otpauth à présenter/scanner.
  const beginEnroll = () =>
    withTok(async (tok) => {
      const r = await enrollTotp(tok);
      setEnroll({ secret: r.secret, url: r.otpauth_url });
    });
  // Confirme l'enrôlement avec le code à 6 chiffres saisi et bascule l'état sur activé.
  const confirm = () =>
    withTok(async (tok) => {
      await confirmTotp(tok, code);
      setEnabled(true);
      setEnroll(null);
      setCode("");
    });
  // Désactive le TOTP après vérification du mot de passe (et d'un code step-up en prod).
  const disable = () =>
    withTok(async (tok) => {
      try {
        await disableTotp(tok, password);
      } catch (e) {
        // En prod, un code frais est exigé en plus du mot de passe : on demande le step-up et on rejoue une fois.
        if (e instanceof StepUpRequiredError) {
          const stepUpToken = await requestStepUp();
          await disableTotp(tok, password, stepUpToken);
        } else {
          throw e;
        }
      }
      setEnabled(false);
      setDisarming(false);
      setPassword("");
    });

  return (
    <div className="card border border-base-content/10 bg-base-100 p-5">
      <h2 className="text-lg font-semibold text-base-content">{t("security.twoFactor.title")}</h2>
      <p className="mt-1 text-sm text-base-content/60">{t("security.twoFactor.desc")}</p>
      <div className="mt-4">
        {error && (
          <p role="alert" className="mb-3 text-sm text-error">
            {error}
          </p>
        )}

        {enabled ? (
          disarming ? (
            <div className="space-y-3">
              <label className="block text-sm font-medium">
                {t("security.twoFactor.passwordLabel")}
                <input
                  type="password"
                  className="input mt-1 w-full max-w-xs"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </label>
              <div className="flex gap-2">
                <button className="btn btn-error" disabled={busy || !password} onClick={disable}>
                  {t("security.twoFactor.confirmDisable")}
                </button>
                <button className="btn btn-soft" disabled={busy} onClick={() => setDisarming(false)}>
                  {t("common.actions.cancel")}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <span className="badge badge-success gap-1">
                <span className="icon-[tabler--shield-check] size-4" />
                {t("security.twoFactor.on")}
              </span>
              <button className="btn btn-soft btn-sm" onClick={() => setDisarming(true)}>
                {t("security.twoFactor.disable")}
              </button>
            </div>
          )
        ) : enroll ? (
          <div className="space-y-3">
            <p className="text-sm text-base-content/70">{t("security.twoFactor.scanHint")}</p>
            <div className="rounded-box bg-base-200/60 p-3">
              <p className="text-xs text-base-content/50">{t("security.twoFactor.secret")}</p>
              <code className="break-all text-sm font-semibold">{enroll.secret}</code>
              <p className="mt-2 text-xs text-base-content/50">{t("security.twoFactor.otpauth")}</p>
              <code className="break-all text-xs text-base-content/70">{enroll.url}</code>
            </div>
            <label className="block text-sm font-medium">
              {t("security.twoFactor.codeLabel")}
              <TotpCodeInput value={code} onChange={setCode} />
            </label>
            <div className="flex gap-2">
              <button className="btn btn-primary" disabled={busy || code.length !== TOTP_CODE_LENGTH} onClick={confirm}>
                {t("security.twoFactor.verify")}
              </button>
              <button className="btn btn-soft" disabled={busy} onClick={() => setEnroll(null)}>
                {t("common.actions.cancel")}
              </button>
            </div>
          </div>
        ) : (
          <button className="btn btn-primary" disabled={busy} onClick={beginEnroll}>
            {t("security.twoFactor.enable")}
          </button>
        )}
      </div>
    </div>
  );
}
