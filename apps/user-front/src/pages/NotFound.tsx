import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

export default function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <p className="text-6xl font-black text-[color:var(--color-brand)]">404</p>
      <h1 className="text-2xl font-extrabold text-neutral-900 dark:text-neutral-50">{t("notFound.title")}</h1>
      <p className="max-w-sm text-neutral-500 dark:text-neutral-400">{t("notFound.desc")}</p>
      <Link
        to="/"
        className="mt-2 rounded-lg bg-[color:var(--color-brand)] px-5 py-2.5 font-semibold text-white hover:bg-[color:var(--color-brand-dark)]"
      >
        {t("notFound.home")}
      </Link>
    </div>
  );
}
