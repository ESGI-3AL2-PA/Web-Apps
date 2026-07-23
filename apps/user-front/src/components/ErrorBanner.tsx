import { useTranslation } from "react-i18next";

/**
 * Bandeau d'erreur inline avec un bouton « réessayer ».
 *
 * @param message - message à afficher ; à défaut, le message de chargement générique.
 * @param onRetry - appelé au clic sur le bouton réessayer.
 */
export default function ErrorBanner({ message, onRetry }: { message?: string; onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span className="text-xl">⚠️</span>
        <p className="text-sm font-medium text-red-800 dark:text-red-200">{message ?? t("common.loadError")}</p>
      </div>
      <button
        onClick={onRetry}
        className="rounded-lg border border-red-300 dark:border-red-800 bg-white dark:bg-neutral-900 px-4 py-2 text-sm font-semibold text-red-700 dark:text-red-200 hover:bg-red-100 dark:hover:bg-red-900/40"
      >
        {t("common.retry")}
      </button>
    </div>
  );
}
