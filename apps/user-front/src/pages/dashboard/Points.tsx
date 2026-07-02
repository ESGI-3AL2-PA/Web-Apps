import { useEffect, useState } from "react";
import { useAuth } from "@repo/hooks";
import { useTranslation } from "react-i18next";
import { getUserTransactions } from "../../api-service/api";

type Metrics = { given: number; received: number; exchanged: number };

const Points = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const balance = user?.balance ?? 0;
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getUserTransactions(user.id, { limit: 100 })
      .then((res) => {
        if (cancelled) return;
        const received = res.data
          .filter((tx) => tx.type === "credit" || tx.type === "transfer_in")
          .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
        const given = res.data
          .filter((tx) => tx.type === "debit" || tx.type === "transfer_out")
          .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
        setMetrics({ given, received, exchanged: res.total });
      })
      .catch(() => {
        if (!cancelled) setMetrics(null);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const statCardClass = "card card-xs bg-brand-soft p-3 text-white";
  const value = (n?: number) => (n === undefined ? "—" : n);

  return (
    <div className="card card-lg mt-10 max-w-sm bg-primary p-5 text-primary-content">
      <h2 className="card-title text-3xl">{t("dashboard.balance")}</h2>
      <p>
        <span className="text-2xl">{balance} </span>
        {t("dashboard.points")}
      </p>
      <div className="mt-5 flex flex-row justify-around gap-2">
        <div className={statCardClass}>
          {t("dashboard.given")} : <span>{value(metrics?.given)}</span>
        </div>
        <div className={statCardClass}>
          {t("dashboard.received")} : <span>{value(metrics?.received)}</span>
        </div>
        <div className={statCardClass}>
          {t("dashboard.exchanged")} : <span>{value(metrics?.exchanged)}</span>
        </div>
      </div>
    </div>
  );
};

export default Points;
