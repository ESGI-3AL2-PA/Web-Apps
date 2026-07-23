import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

/** Page 404 : affichée pour toute route inconnue, avec un lien de retour à l'accueil. */
export default function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <p className="text-6xl font-black text-primary">404</p>
      <h1 className="text-2xl font-extrabold text-base-content">{t("notFound.title")}</h1>
      <p className="max-w-sm text-base-content/60">{t("notFound.desc")}</p>
      <Link to="/" className="btn btn-primary mt-2">
        {t("notFound.home")}
      </Link>
    </div>
  );
}
