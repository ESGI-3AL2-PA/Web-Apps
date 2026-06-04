import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { IncidentStatsDto } from "@repo/contracts";
import { getIncidentStats } from "../../api-service/incidents";
import { listUsers } from "../../api-service/users";
import { listListings } from "../../api-service/listings";

interface StatCard {
  label: string;
  value: number | string;
  icon: string;
  to: string;
  accent: string;
}

export default function Dashboard() {
  const [stats, setStats] = useState<IncidentStatsDto | null>(null);
  const [userCount, setUserCount] = useState<number | null>(null);
  const [listingCount, setListingCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getIncidentStats(), listUsers({ page: 1, limit: 1 }), listListings({ page: 1, limit: 1 })])
      .then(([s, u, l]) => {
        if (cancelled) return;
        setStats(s);
        setUserCount(u.total);
        setListingCount(l.total);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.response?.data?.message ?? err?.message ?? "Failed to load");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const cards: StatCard[] = [
    { label: "Users", value: userCount ?? "—", icon: "icon-[tabler--users]", to: "/users", accent: "text-primary" },
    {
      label: "Listings",
      value: listingCount ?? "—",
      icon: "icon-[tabler--clipboard-list]",
      to: "/listings",
      accent: "text-info",
    },
    {
      label: "Total incidents",
      value: stats?.total ?? "—",
      icon: "icon-[tabler--alert-triangle]",
      to: "/incidents",
      accent: "text-warning",
    },
    {
      label: "Open incidents",
      value: stats?.byStatus.open ?? 0,
      icon: "icon-[tabler--flame]",
      to: "/incidents",
      accent: "text-error",
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
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
            <p className="text-3xl font-semibold mt-2">{c.value}</p>
          </Link>
        ))}
      </div>

      {stats && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <StatsBlock title="Incidents by status" entries={Object.entries(stats.byStatus)} />
          <StatsBlock title="Incidents by category" entries={Object.entries(stats.byCategory)} />
          <StatsBlock title="Incidents by district" entries={Object.entries(stats.byDistrict)} />
        </div>
      )}
    </div>
  );
}

function StatsBlock({ title, entries }: { title: string; entries: [string, number][] }) {
  return (
    <div className="bg-base-100 rounded-box border border-base-content/10 p-5">
      <h2 className="font-medium mb-3">{title}</h2>
      {entries.length === 0 ? (
        <p className="text-sm text-base-content/60">No data</p>
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
