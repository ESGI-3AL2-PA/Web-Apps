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

function isValidPolygon(geoJson: GeoJson): geoJson is GeoJsonInput {
  return (
    geoJson.type === "Polygon" &&
    Array.isArray(geoJson.coordinates) &&
    geoJson.coordinates.length > 0 &&
    geoJson.coordinates.every((ring) => Array.isArray(ring) && ring.length >= 4)
  );
}

const errMessage = (err: unknown, fallback: string): string => {
  const e = err as { response?: { data?: { message?: string } }; message?: string };
  return e?.response?.data?.message ?? e?.message ?? fallback;
};

// The Districts screen is a map view of the active district (the one in scope): edit its
// name/boundary/starting points and save in place. A superAdmin switches which district this
// shows via the top-bar selector, and can create a new one via "New district".
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

    // `required` blocks a truly-empty field but not a whitespace-only one, and gives no
    // in-app message — validate explicitly and save the trimmed value.
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError(t("districts.nameRequired"));
      return;
    }

    if (geoJson && !isValidPolygon(geoJson)) {
      setError(t("districts.invalidPolygon"));
      return;
    }

    setSubmitting(true);
    try {
      // null explicitly clears an existing boundary; undefined would be dropped by JSON.
      await updateDistrict(districtId, { name: trimmedName, geoJson, startingPoints });
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
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError(t("districts.nameRequired"));
      return;
    }
    if (!geoJson || !isValidPolygon(geoJson)) {
      setError(t("districts.invalidPolygon"));
      return;
    }
    setSubmitting(true);
    try {
      const created = await createDistrict({ name: trimmedName, geoJson, startingPoints });
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
