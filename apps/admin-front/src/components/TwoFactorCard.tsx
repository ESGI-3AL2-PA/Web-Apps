import { useState } from "react";
import { useTranslation } from "react-i18next";
import { confirmTotp, disableTotp, enrollTotp, StepUpRequiredError } from "../api-service/totp";
import { useStepUp } from "./step-up-context";

// TOTP enrollment for admins: enable = enroll → show secret/otpauth → confirm a 6-digit
// code; disable = re-enter the password (plus a step-up code in production). Mirrors the
// user-front TwoFactorCard; the auth endpoints live on the auth-service (totp service).
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

  const beginEnroll = () =>
    withTok(async (tok) => {
      const r = await enrollTotp(tok);
      setEnroll({ secret: r.secret, url: r.otpauth_url });
    });
  const confirm = () =>
    withTok(async (tok) => {
      await confirmTotp(tok, code);
      setEnabled(true);
      setEnroll(null);
      setCode("");
    });
  const disable = () =>
    withTok(async (tok) => {
      try {
        await disableTotp(tok, password);
      } catch (e) {
        // Production requires a fresh code on top of the password — prompt and retry once.
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
              <input
                inputMode="numeric"
                maxLength={6}
                className="input mt-1 w-40 tracking-[0.3em]"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
              />
            </label>
            <div className="flex gap-2">
              <button className="btn btn-primary" disabled={busy || code.length !== 6} onClick={confirm}>
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
