// Page « Sécurité » du compte : héberge la carte de gestion de la double authentification (2FA/TOTP).
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@repo/hooks";
import { TwoFactorCard } from "../../components/TwoFactorCard";

export default function SecurityPage() {
  const { t } = useTranslation();
  const { user, getAccessToken, refresh } = useAuth();

  // Fournisseur de token pour TwoFactorCard : renvoie l'access token courant, ou le rafraîchit
  // s'il est absent/expiré.
  const token = useCallback(
    async (): Promise<string | null> => getAccessToken() ?? (await refresh()),
    [getAccessToken, refresh],
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("security.title")}</h1>
        <p className="text-sm text-base-content/60">{t("security.subtitle")}</p>
      </div>
      <TwoFactorCard token={token} initialEnabled={!!user?.totpEnabled} />
    </div>
  );
}
