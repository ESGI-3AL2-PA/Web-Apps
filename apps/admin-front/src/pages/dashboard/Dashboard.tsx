import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { IncidentStatsDto } from "@repo/contracts";
import { getIncidentStats } from "../../api-service/incidents";
import { listUsers } from "../../api-service/users";
import { listListings } from "../../api-service/listings";
import { useDistrictScope } from "../../app/DistrictScopeProvider";

interface StatCard {
  label: string;
  value: number | string;
  icon: string;
  to: string;
  accent: string;
}

export default function Dashboard() {
  const { t } = useTranslation();
  const { districtId } = useDistrictScope();
  const [stats, setStats] = useState<IncidentStatsDto | null>(null);
  const [userCount, setUserCount] = useState<number | null>(null);
  const [listingCount, setListingCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const scoped = districtId ?? undefined;
    setLoading(true);
    setError(null);
    Promise.all([
      getIncidentStats(scoped),
      listUsers({ page: 1, limit: 1, ...(scoped && { districtId: scoped }) }),
      listListings({ page: 1, limit: 1, ...(scoped && { districtId: scoped }) }),
    ])
      .then(([s, u, l]) => {
        if (cancelled) return;
        setStats(s);
        setUserCount(u.total);
        setListingCount(l.total);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.response?.data?.message ?? err?.message ?? t("common.states.failedToLoad"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [districtId, t]);

  const cards: StatCard[] = [
    {
      label: t("dashboard.cardUsers"),
      value: userCount ?? 0,
      icon: "icon-[tabler--users]",
      to: "/users",
      accent: "text-primary",
    },
    {
      label: t("dashboard.cardListings"),
      value: listingCount ?? 0,
      icon: "icon-[tabler--clipboard-list]",
      to: "/listings",
      accent: "text-info",
    },
    {
      label: t("dashboard.cardTotalIncidents"),
      value: stats?.total ?? 0,
      icon: "icon-[tabler--alert-triangle]",
      to: "/incidents",
      accent: "text-warning",
    },
    {
      label: t("dashboard.cardOpenIncidents"),
      value: stats?.byStatus.open ?? 0,
      icon: "icon-[tabler--flame]",
      to: "/incidents",
      accent: "text-error",
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t("dashboard.title")}</h1>
      {error && <p className="text-error text-sm">{error}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Link
            key={c.label}
            to={c.to}
            className="bg-base-100 rounded-box border border-base-content/10 p-5 hover:shadow-md transition"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-base-content/60">{c.label}</span>
              <span className={`${c.icon} size-6 ${c.accent}`} />
            </div>
            {loading ? (
              <div className="h-9 w-16 rounded bg-base-200 animate-pulse mt-2" />
            ) : (
              <p className="text-3xl font-semibold mt-2">{c.value}</p>
            )}
          </Link>
        ))}
      </div>

      {stats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <StatsBlock
            title={t("dashboard.byStatus")}
            entries={Object.entries(stats.byStatus).map(([k, v]) => [t(`status.${k}`, k), v])}
          />
          <StatsBlock title={t("dashboard.byCategory")} entries={Object.entries(stats.byCategory)} />
        </div>
      )}
    </div>
  );
}

function StatsBlock({ title, entries }: { title: string; entries: [string, number][] }) {
  const { t } = useTranslation();
  return (
    <div className="bg-base-100 rounded-box border border-base-content/10 p-5">
      <h2 className="font-medium mb-3">{title}</h2>
      {entries.length === 0 ? (
        <p className="text-sm text-base-content/60">{t("common.states.noData")}</p>
      ) : (
        <ul className="space-y-1.5">
          {entries.map(([key, value]) => (
            <li key={key} className="flex justify-between text-sm">
              <span className="text-base-content/70 truncate">{key}</span>
              <span className="font-medium">{value}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
