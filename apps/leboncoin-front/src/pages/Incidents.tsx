import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@repo/hooks";
import type { IncidentResponseDto, IncidentStatus } from "@repo/contracts";
import { createIncident, getIncidents } from "../api-service/incidents.service";
import { getUserById } from "../api-service/users.service";
import { formatRelative } from "../lib/format";
import { useDialog } from "../components/DialogProvider";

const CATEGORIES = ["cleanliness", "safety", "vandalism", "noise", "other"] as const;

const STATUS_CLASS: Record<IncidentStatus, string> = {
  open: "bg-amber-100 text-amber-800",
  in_progress: "bg-blue-100 text-blue-800",
  resolved: "bg-green-100 text-green-800",
  closed: "bg-neutral-100 text-neutral-700",
};

export default function Incidents() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { alert } = useDialog();
  const [incidents, setIncidents] = useState<IncidentResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [districtId, setDistrictId] = useState<string | null>(user?.districtId ?? null);
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    if (!user?.id) return;
    setLoading(true);
    getIncidents({ reporterId: user.id, limit: 50 } as never)
      .then((page) => setIncidents(page.data))
      .catch(() => setIncidents([]))
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
        <h1 className="text-2xl font-extrabold text-neutral-900">{t("incidents.title")}</h1>
        <p className="text-neutral-500">{t("incidents.subtitle")}</p>
      </div>

      {/* Report form */}
      <form onSubmit={submit} className="space-y-3 rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="text-lg font-bold text-neutral-900">{t("incidents.report")}</h2>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            {t("incidents.category")}
          </span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-1 h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm outline-none focus:border-[color:var(--color-brand)]"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`incidents.categories.${c}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            {t("incidents.description")}
          </span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder={t("incidents.descriptionPlaceholder")}
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-[color:var(--color-brand)]"
          />
        </label>
        <button
          type="submit"
          disabled={submitting || !description.trim() || !districtId}
          className="rounded-lg bg-[color:var(--color-brand)] px-4 py-2 text-sm font-semibold text-white hover:bg-[color:var(--color-brand-dark)] disabled:opacity-60"
        >
          {submitting ? t("incidents.submitting") : t("incidents.submit")}
        </button>
      </form>

      {/* My incidents */}
      <section>
        <h2 className="mb-3 text-lg font-bold text-neutral-900">{t("incidents.mine")}</h2>
        {loading ? (
          <p className="text-sm text-neutral-500">{t("common.loading")}</p>
        ) : incidents.length === 0 ? (
          <p className="text-sm text-neutral-500">{t("incidents.empty")}</p>
        ) : (
          <ul className="space-y-3">
            {incidents.map((i) => (
              <li key={i.id} className="rounded-xl border border-neutral-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-neutral-900">
                    {t(`incidents.categories.${i.category}`, { defaultValue: i.category })}
                  </span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASS[i.status]}`}>
                    {t(`incidents.status.${i.status}`)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-neutral-700">{i.description}</p>
                <p className="mt-1 text-xs text-neutral-400">{formatRelative(i.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
