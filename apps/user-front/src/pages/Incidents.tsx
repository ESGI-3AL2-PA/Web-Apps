import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@repo/hooks";
import type { IncidentResponseDto, IncidentStatus } from "@repo/contracts";
import { createIncident, getIncidents } from "../api-service/incidents.service";
import { getUserById } from "../api-service/users.service";
import { formatRelative } from "../lib/format";
import { useDialog } from "../components/dialog-context";
import ErrorBanner from "../components/ErrorBanner";

// Page : signalements (incidents) du quartier. Formulaire de dépôt + liste des
// signalements de l'utilisateur (bornée côté serveur au demandeur).

// Catégories de signalement proposées dans le formulaire.
const CATEGORIES = ["cleanliness", "safety", "vandalism", "noise", "other"] as const;

// Classes de badge par statut de signalement.
const STATUS_CLASS: Record<IncidentStatus, string> = {
  open: "badge badge-warning badge-soft",
  in_progress: "badge badge-info badge-soft",
  resolved: "badge badge-success badge-soft",
  closed: "badge badge-neutral badge-soft",
};

/**
 * Page des signalements : formulaire de dépôt (catégorie + description, rattaché
 * au quartier de l'utilisateur) et liste de ses propres signalements avec statut.
 */
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
    let ignore = false;
    setLoading(true);
    setError(false);
    // Pas de reporterId : le backend borne déjà la liste aux signalements du demandeur.
    getIncidents({ limit: 50 })
      .then((page) => {
        if (!ignore) setIncidents(page.data);
      })
      .catch(() => {
        if (!ignore) setError(true);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [user?.id]);

  useEffect(load, [load]);

  // Le quartier est requis pour signaler ; on le résout depuis le profil si le
  // token ne le porte pas.
  useEffect(() => {
    if (districtId || !user?.id) return;
    let ignore = false;
    getUserById(user.id)
      .then((u) => {
        if (!ignore) setDistrictId(u.districtId ?? null);
      })
      .catch(() => undefined);
    return () => {
      ignore = true;
    };
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

      {/* Formulaire de dépôt d'un signalement */}
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

      {/* Mes signalements */}
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
