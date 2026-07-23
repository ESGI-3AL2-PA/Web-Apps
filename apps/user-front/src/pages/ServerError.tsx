import { useTranslation } from "react-i18next";

// Page d'erreur 500 plein écran, affichée quand l'api est injoignable. Autonome
// (aucune dépendance au router ni à l'api) afin de s'afficher même si tout le reste
// est hors service.
/**
 * @param onRetry callback optionnel de nouvelle tentative ; le bouton n'apparaît que s'il est fourni.
 * @param retrying passe le bouton en état chargement (spinner + libellé « réessai en cours »).
 */
export default function ServerError({ onRetry, retrying }: { onRetry?: () => void; retrying?: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-base-100 p-6 text-center">
      <p className="text-6xl font-black text-error">500</p>
      <h1 className="text-2xl font-extrabold text-base-content">{t("serverError.title")}</h1>
      <p className="max-w-sm text-base-content/60">{t("serverError.desc")}</p>
      {onRetry && (
        <button onClick={onRetry} disabled={retrying} className="btn btn-primary mt-2">
          {retrying && <span className="loading loading-spinner loading-sm" />}
          {retrying ? t("serverError.retrying") : t("serverError.retry")}
        </button>
      )}
    </div>
  );
}
