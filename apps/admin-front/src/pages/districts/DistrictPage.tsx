import { useEffect, useState, type FormEvent } from "react";
import type { GeoJson } from "@repo/contracts";
import { getDistrict, updateDistrict } from "../../api-service/districts";
import { Field } from "../../components/Field";
import { useDistrictScope } from "../../app/DistrictScopeProvider";
import { DistrictMapEditor } from "./DistrictMapEditor";

function isValidPolygon(geoJson: GeoJson): boolean {
  return (
    geoJson.type === "Polygon" &&
    Array.isArray(geoJson.coordinates) &&
    geoJson.coordinates.length > 0 &&
    geoJson.coordinates.every((ring) => Array.isArray(ring) && ring.length >= 4)
  );
}

// The Districts screen is a direct map view of the active district (the one in scope): edit its
// name/boundary and save in place. superAdmin switches which district this shows via the top-bar
// selector. There is no list/create/delete — the deployment has a single district.
export default function DistrictPage() {
  const { districtId, loading: scopeLoading } = useDistrictScope();

  const [name, setName] = useState("");
  const [geoJson, setGeoJson] = useState<GeoJson | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!districtId) {
      setName("");
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
        setGeoJson(d.geoJson ?? null);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load district.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [districtId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);
    if (!districtId) return;

    if (geoJson && !isValidPolygon(geoJson)) {
      setError("Draw a valid polygon (at least 3 distinct points) before saving.");
      return;
    }

    setSubmitting(true);
    try {
      // null explicitly clears an existing boundary; undefined would be dropped by JSON.
      await updateDistrict(districtId, { name, geoJson });
      setSaved(true);
    } catch (err: unknown) {
      const e2 = err as { response?: { data?: { message?: string } }; message?: string };
      setError(e2?.response?.data?.message ?? e2?.message ?? "Failed to save");
    } finally {
      setSubmitting(false);
    }
  };

  if (scopeLoading || loading) {
    return (
      <div className="flex items-center justify-center h-full text-base-content/60">
        <span className="loading loading-spinner loading-sm" /> Loading…
      </div>
    );
  }

  if (!districtId) {
    return <p className="text-sm text-base-content/60">No district in scope.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 h-[calc(100vh-8.5rem)]">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{name || "District"}</h1>
        <div className="flex items-center gap-3">
          {saved && <span className="text-sm text-success">Saved</span>}
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting && <span className="loading loading-spinner loading-xs" />}
            Save
          </button>
        </div>
      </div>

      <Field label="Name" required>
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

      {!geoJson && (
        <p className="text-xs text-base-content/60">
          No boundary set — this district won&apos;t match any addresses until one is drawn.
        </p>
      )}
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
  );
}
