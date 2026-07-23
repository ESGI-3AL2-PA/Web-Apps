// Page Quartiers de la console : vue carte du quartier actif (celui en scope) pour éditer son
// nom, son tracé et ses points de départ, avec sauvegarde sur place. Un superAdmin peut basculer
// de quartier via le sélecteur de barre supérieure et en créer un nouveau via une modale.
import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@repo/hooks";
import type { GeoJson, GeoJsonInput } from "@repo/contracts";
import { createDistrict, getDistrict, updateDistrict } from "../../api-service/districts";
import { Field } from "../../components/Field";
import { FormModal } from "../../components/FormModal";
import { useToast } from "../../components/Toast";
import { useDistrictScope } from "../../app/DistrictScopeProvider";
import { DistrictMapEditor } from "./DistrictMapEditor";

/**
 * Vérifie qu'un GeoJSON est un Polygon exploitable : type Polygon et chaque anneau ferme
 * comportant au moins 4 positions (contrainte minimale d'un anneau linéaire fermé).
 * Sert de garde de type pour restreindre `GeoJson` à `GeoJsonInput` avant envoi à l'API.
 */
function isValidPolygon(geoJson: GeoJson): geoJson is GeoJsonInput {
  return (
    geoJson.type === "Polygon" &&
    Array.isArray(geoJson.coordinates) &&
    geoJson.coordinates.length > 0 &&
    geoJson.coordinates.every((ring) => Array.isArray(ring) && ring.length >= 4)
  );
}

/** Extrait un message d'erreur lisible (réponse API puis message brut), avec repli fourni. */
const errMessage = (err: unknown, fallback: string): string => {
  const e = err as { response?: { data?: { message?: string } }; message?: string };
  return e?.response?.data?.message ?? e?.message ?? fallback;
};

export default function DistrictPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "superAdmin";
  const { districtId, loading: scopeLoading } = useDistrictScope();
  const toast = useToast();

  const [name, setName] = useState("");
  const [startingPoints, setStartingPoints] = useState(0);
  const [geoJson, setGeoJson] = useState<GeoJson | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [creating, setCreating] = useState(false);

  // Charge le quartier actif à chaque changement de scope ; réinitialise le formulaire si aucun
  // quartier n'est sélectionné. `cancelled` neutralise une réponse tardive après un nouveau scope.
  useEffect(() => {
    if (!districtId) {
      setName("");
      setStartingPoints(0);
      setGeoJson(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSaved(false);
    getDistrict(districtId)
      .then((d) => {
        if (cancelled) return;
        setName(d.name);
        setStartingPoints(d.startingPoints);
        setGeoJson(d.geoJson ?? null);
      })
      .catch(() => {
        if (!cancelled) setError(t("districts.loadFailed"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [districtId, t]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);
    if (!districtId) return;

    if (geoJson && !isValidPolygon(geoJson)) {
      setError(t("districts.invalidPolygon"));
      return;
    }

    setSubmitting(true);
    try {
      // null efface explicitement un tracé existant ; undefined serait supprimé par la sérialisation JSON.
      await updateDistrict(districtId, { name, geoJson, startingPoints });
      setSaved(true);
      toast.show(t("districts.saved"));
    } catch (err: unknown) {
      setError(errMessage(err, t("common.states.failedToSave")));
    } finally {
      setSubmitting(false);
    }
  };

  if (scopeLoading || loading) {
    return (
      <div className="flex items-center justify-center h-full text-base-content/60">
        <span className="loading loading-spinner loading-sm" /> {t("common.states.loading")}
      </div>
    );
  }

  return (
    <>
      {creating && <NewDistrictModal onClose={() => setCreating(false)} />}

      {!districtId ? (
        <div className="space-y-3">
          <p className="text-sm text-base-content/60">{t("districts.noScope")}</p>
          {isSuperAdmin && (
            <button className="btn btn-primary" onClick={() => setCreating(true)}>
              <span className="icon-[tabler--plus] size-4" /> {t("districts.create")}
            </button>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 h-[calc(100vh-8.5rem)]">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold">{name || t("districts.title")}</h1>
            <div className="flex items-center gap-3">
              {saved && <span className="text-sm text-success">{t("common.states.saved")}</span>}
              {isSuperAdmin && (
                <button type="button" className="btn btn-soft" onClick={() => setCreating(true)}>
                  <span className="icon-[tabler--plus] size-4" /> {t("districts.create")}
                </button>
              )}
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting && <span className="loading loading-spinner loading-xs" />}
                {t("common.actions.save")}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <Field label={t("common.fields.name")} required>
              <input
                className="input max-w-md"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setSaved(false);
                }}
                required
              />
            </Field>
            <Field label={t("districts.startingPoints")}>
              <input
                type="number"
                min={0}
                className="input max-w-40"
                value={startingPoints}
                onChange={(e) => {
                  setStartingPoints(Math.max(0, Math.floor(Number(e.target.value) || 0)));
                  setSaved(false);
                }}
              />
            </Field>
          </div>

          {!geoJson && <p className="text-xs text-base-content/60">{t("districts.noBoundary")}</p>}
          {error && <p className="text-sm text-error">{error}</p>}

          <DistrictMapEditor
            value={geoJson}
            onChange={(g) => {
              setGeoJson(g);
              setSaved(false);
            }}
            className="flex-1 min-h-0"
          />
        </form>
      )}
    </>
  );
}

/**
 * Modale de création d'un quartier (superAdmin) : nom, points de départ et tracé obligatoire.
 * Après création réussie, recharge le scope sur le nouveau quartier via `reload(id)` puis ferme.
 */
function NewDistrictModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { reload } = useDistrictScope();

  const [name, setName] = useState("");
  const [startingPoints, setStartingPoints] = useState(100);
  const [geoJson, setGeoJson] = useState<GeoJson | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!geoJson || !isValidPolygon(geoJson)) {
      setError(t("districts.invalidPolygon"));
      return;
    }
    setSubmitting(true);
    try {
      const created = await createDistrict({ name, geoJson, startingPoints });
      toast.show(t("districts.created"));
      await reload(created.id);
      onClose();
    } catch (err: unknown) {
      setError(errMessage(err, t("common.states.failedToSave")));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormModal
      open
      title={t("districts.create")}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitLabel={t("common.actions.create")}
      submitting={submitting}
      error={error}
      size="lg"
    >
      <Field label={t("common.fields.name")} required>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
      </Field>
      <Field label={t("districts.startingPoints")}>
        <input
          type="number"
          min={0}
          className="input max-w-40"
          value={startingPoints}
          onChange={(e) => setStartingPoints(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
        />
      </Field>
      <div>
        <p className="mb-2 text-sm text-base-content/70">{t("districts.drawBoundary")}</p>
        <DistrictMapEditor value={geoJson} onChange={setGeoJson} className="h-80" />
      </div>
    </FormModal>
  );
}
