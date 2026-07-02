import { Link, useRouteError, isRouteErrorResponse } from "react-router-dom";
import { useTranslation } from "react-i18next";

const NotFound = () => {
  const { t } = useTranslation();
  const error = useRouteError();
  const is404 = isRouteErrorResponse(error) && error.status === 404;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-5xl font-bold text-primary">{is404 ? t("notFound.title404") : t("notFound.titleError")}</h1>
      <p className="text-lg text-base-content">{is404 ? t("notFound.msg404") : t("notFound.msgError")}</p>
      <Link to="/" className="btn btn-primary">
        {t("notFound.home")}
      </Link>
    </div>
  );
};

export default NotFound;
