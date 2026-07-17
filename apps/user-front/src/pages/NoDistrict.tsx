import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@repo/hooks";
import { config } from "@repo/config";
import type { DistrictResponseDto } from "@repo/contracts";
import { resolveMyDistrict } from "../api-service/users.service";

// Access-denied wall shown to a district-less regular user (see DistrictGuard). Offers to
// re-resolve their district ("check again"), pick one when several overlap their address,
// or head back to the marketing site. District *creation* lives in the admin console, not here.
export default function NoDistrict() {
  const { t } = useTranslation();
  const { refresh } = useAuth();
  const [busy, setBusy] = useState(true);
  const [candidates, setCandidates] = useState<DistrictResponseDto[]>([]);
  const [error, setError] = useState<string | null>(null);

  const resolve = useCallback(
    async (districtId?: string) => {
      setBusy(true);
      setError(null);
      try {
        const res = await resolveMyDistrict(districtId);
        if (res.resolved) {
          // Re-hydrate the auth user so DistrictGuard sees the new districtId and lets us in.
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

  const hasChoice = candidates.length > 1;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-base-100 p-6 text-center">
      <span className="icon-[tabler--map-pin-off] size-16 text-base-content/30" />
      <h1 className="text-2xl font-extrabold text-base-content">{t("noDistrict.title")}</h1>
      <p className="max-w-md text-base-content/60">{hasChoice ? t("noDistrict.chooseDesc") : t("noDistrict.desc")}</p>

      {hasChoice && (
        <div className="flex w-full max-w-xs flex-col gap-2">
          {candidates.map((d) => (
            <button key={d.id} className="btn btn-primary" disabled={busy} onClick={() => resolve(d.id)}>
              {d.name}
            </button>
          ))}
        </div>
      )}

      {error && <p className="max-w-md text-sm text-error">{error}</p>}

      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        {!hasChoice && (
          <button className="btn btn-primary" disabled={busy} onClick={() => resolve()}>
            {busy && <span className="loading loading-spinner loading-sm" />}
            {t("noDistrict.checkAgain")}
          </button>
        )}
        <a className="btn btn-soft" href={config.landingUrl}>
          <span className="icon-[tabler--arrow-left] size-4" />
          {t("noDistrict.backToLanding")}
        </a>
      </div>
    </div>
  );
}
