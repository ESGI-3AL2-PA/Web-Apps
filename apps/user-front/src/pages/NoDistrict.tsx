import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@repo/hooks";
import { config } from "@repo/config";
import { createMyDistrict, resolveMyDistrict } from "../api-service/users.service";

type Candidate = { id: string; name: string };

/**
 * Mur d'accès refusé montré à un utilisateur régulier sans quartier (voir
 * DistrictGuard). Propose de re-résoudre son quartier (« vérifier à nouveau »),
 * d'en choisir un quand plusieurs recouvrent son adresse, ou de créer son propre
 * quartier (ce qui le promeut administrateur de quartier et le redirige vers
 * l'app admin). L'*édition* du quartier se fait là-bas, pas ici.
 */
export default function NoDistrict() {
  const { t } = useTranslation();
  const { refresh } = useAuth();
  const [busy, setBusy] = useState(true);
  const [creating, setCreating] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [error, setError] = useState<string | null>(null);

  const resolve = useCallback(
    async (districtId?: string) => {
      setBusy(true);
      setError(null);
      try {
        const res = await resolveMyDistrict(districtId);
        if (res.resolved) {
          // Ré-hydrate l'utilisateur authentifié pour que DistrictGuard voie le
          // nouveau districtId et nous laisse entrer.
          await refresh();
          return;
        }
        setCandidates(res.candidates);
      } catch (err: unknown) {
        const e = err as { response?: { data?: { message?: string } }; message?: string };
        setError(e?.response?.data?.message ?? e?.message ?? t("noDistrict.error"));
      } finally {
        setBusy(false);
      }
    },
    [refresh, t],
  );

  useEffect(() => {
    void resolve();
  }, [resolve]);

  // Crée un quartier sur l'adresse de l'appelant et en devient l'administrateur,
  // puis passe la main à l'app admin (qui rafraîchit le token → role:admin +
  // adminDistrictId) pour l'affiner.
  const createOwn = async () => {
    setCreating(true);
    setError(null);
    try {
      await createMyDistrict();
      window.location.href = `${config.adminUrl}/districts`;
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setError(e?.response?.data?.message ?? e?.message ?? t("noDistrict.error"));
      setCreating(false);
    }
  };

  const hasChoice = candidates.length > 1;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-base-100 p-6 text-center">
      <span className="icon-[tabler--map-pin-off] size-16 text-base-content/30" />
      <h1 className="text-2xl font-extrabold text-base-content">{t("noDistrict.title")}</h1>
      <p className="max-w-md text-base-content/60">{hasChoice ? t("noDistrict.chooseDesc") : t("noDistrict.desc")}</p>

      {hasChoice && (
        <div className="flex w-full max-w-xs flex-col gap-2">
          {candidates.map((d) => (
            <button key={d.id} className="btn btn-primary" disabled={busy || creating} onClick={() => resolve(d.id)}>
              {d.name}
            </button>
          ))}
        </div>
      )}

      {error && <p className="max-w-md text-sm text-error">{error}</p>}

      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        {!hasChoice && (
          <>
            <button className="btn btn-primary" disabled={busy || creating} onClick={createOwn}>
              {creating && <span className="loading loading-spinner loading-sm" />}
              {t("noDistrict.createOwn")}
            </button>
            <button className="btn btn-soft" disabled={busy || creating} onClick={() => resolve()}>
              {busy && !creating && <span className="loading loading-spinner loading-sm" />}
              {t("noDistrict.checkAgain")}
            </button>
          </>
        )}
        <a className="btn btn-soft" href={config.landingUrl}>
          <span className="icon-[tabler--arrow-left] size-4" />
          {t("noDistrict.backToLanding")}
        </a>
      </div>
    </div>
  );
}
