import { useTranslation } from "react-i18next";

// Full-screen 500 page shown when the api is unreachable. Self-contained (no router
// or api dependencies) so it renders even when everything else is down.
export default function ServerError({ onRetry, retrying }: { onRetry?: () => void; retrying?: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[color:var(--color-canvas)] p-6 text-center">
      <p className="text-6xl font-black text-red-500">500</p>
      <h1 className="text-2xl font-extrabold text-neutral-900 dark:text-neutral-50">{t("serverError.title")}</h1>
      <p className="max-w-sm text-neutral-500 dark:text-neutral-400">{t("serverError.desc")}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          disabled={retrying}
          className="mt-2 rounded-lg bg-[color:var(--color-brand)] px-5 py-2.5 font-semibold text-white hover:bg-[color:var(--color-brand-dark)] disabled:opacity-60"
        >
          {retrying ? t("serverError.retrying") : t("serverError.retry")}
        </button>
      )}
    </div>
  );
}
