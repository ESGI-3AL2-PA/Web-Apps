import { useTranslation } from "react-i18next";

type ComingSoonProps = {
  title: string;
};

const ComingSoon = ({ title }: ComingSoonProps) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
      <span className="text-5xl" aria-hidden="true">
        🚧
      </span>
      <h1 className="text-2xl font-bold text-base-content">{title}</h1>
      <p className="max-w-md text-base-content/60">{t("comingSoon")}</p>
    </div>
  );
};

export default ComingSoon;
