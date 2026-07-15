import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@repo/hooks";
import type { IncidentResponseDto, IncidentStatus } from "@repo/contracts";
import { createIncident, getIncidents } from "../api-service/incidents.service";
import { getUserById } from "../api-service/users.service";
import { formatRelative } from "../lib/format";
import { useDialog } from "../components/dialog-context";
import ErrorBanner from "../components/ErrorBanner";

const CATEGORIES = ["cleanliness", "safety", "vandalism", "noise", "other"] as const;

const STATUS_CLASS: Record<IncidentStatus, string> = {
  open: "badge badge-warning badge-soft",
  in_progress: "badge badge-info badge-soft",
  resolved: "badge badge-success badge-soft",
  closed: "badge badge-neutral badge-soft",
};

export default function Incidents() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { alert } = useDialog();
  const [incidents, setIncidents] = useState<IncidentResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [districtId, setDistrictId] = useState<string | null>(user?.districtId ?? null);
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    if (!user?.id) return;
    setLoading(true);
    setError(false);
    getIncidents({ reporterId: user.id, limit: 50 })
      .then((page) => setIncidents(page.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  // District is required to report; resolve it from the profile if the token lacks it.
  useEffect(() => {
    if (districtId || !user?.id) return;
    getUserById(user.id)
      .then((u) => setDistrictId(u.districtId ?? null))
      .catch(() => undefined);
  }, [districtId, user?.id]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !districtId) return;
    setSubmitting(true);
    try {
      const created = await createIncident({ districtId, category, description: description.trim() });
      setIncidents((prev) => [created, ...prev]);
      setDescription("");
      setCategory(CATEGORIES[0]);
    } catch {
      await alert({ message: t("incidents.error") });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-base-content">{t("incidents.title")}</h1>
        <p className="text-base-content/60">{t("incidents.subtitle")}</p>
      </div>

      {/* Report form */}
      <form onSubmit={submit} className="space-y-3 rounded-box border border-base-content/10 bg-base-100 p-5">
        <h2 className="text-lg font-bold text-base-content">{t("incidents.report")}</h2>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
            {t("incidents.category")}
          </span>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="select mt-1 w-full">
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`incidents.categories.${c}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
            {t("incidents.description")}
          </span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder={t("incidents.descriptionPlaceholder")}
            className="textarea mt-1 w-full"
          />
        </label>
        <button type="submit" disabled={submitting || !description.trim() || !districtId} className="btn btn-primary">
          {submitting ? t("incidents.submitting") : t("incidents.submit")}
        </button>
      </form>

      {/* My incidents */}
      <section>
        <h2 className="mb-3 text-lg font-bold text-base-content">{t("incidents.mine")}</h2>
        {loading ? (
          <p className="text-sm text-base-content/60">{t("common.loading")}</p>
        ) : error ? (
          <ErrorBanner onRetry={load} />
        ) : incidents.length === 0 ? (
          <p className="text-sm text-base-content/60">{t("incidents.empty")}</p>
        ) : (
          <ul className="space-y-3">
            {incidents.map((i) => (
              <li key={i.id} className="rounded-box border border-base-content/10 bg-base-100 p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-base-content">
                    {t(`incidents.categories.${i.category}`, { defaultValue: i.category })}
                  </span>
                  <span className={STATUS_CLASS[i.status]}>{t(`incidents.status.${i.status}`)}</span>
                </div>
                <p className="mt-1 text-sm text-base-content/80">{i.description}</p>
                <p className="mt-1 text-xs text-base-content/60">{formatRelative(i.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
