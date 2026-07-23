import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@repo/hooks";
import { config } from "@repo/config";
import { createMyDistrict, getUserById, resolveMyDistrict, updateUser } from "../api-service/users.service";
import AddressAutocomplete from "../components/AddressAutocomplete";

type Candidate = { id: string; name: string };

/**
 * Mur d'accès refusé montré à un utilisateur régulier sans quartier (voir
 * DistrictGuard). Propose de re-résoudre son quartier (« vérifier à nouveau »),
 * d'en choisir un quand plusieurs recouvrent son adresse, de corriger son adresse
 * (une adresse mal saisie est la cause la plus fréquente d'un non-rattachement),
 * ou de créer son propre quartier (ce qui le promeut administrateur de quartier et
 * le redirige vers l'app admin). L'*édition* du quartier se fait là-bas, pas ici.
 */
export default function NoDistrict() {
  const { t } = useTranslation();
  const { user, refresh } = useAuth();
  const uid = user?.id;
  const [busy, setBusy] = useState(true);
  const [creating, setCreating] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editingAddress, setEditingAddress] = useState(false);
  const [address, setAddress] = useState("");
  const [currentAddress, setCurrentAddress] = useState("");
  const [savingAddress, setSavingAddress] = useState(false);

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

  // Adresse enregistrée, affichée sous la description pour que l'utilisateur voie
  // ce qui a été géocodé. Best-effort : un échec la masque simplement. Le champ de
  // saisie, lui, démarre vide — préremplir déclencherait l'autocomplétion BAN dès
  // l'ouverture du formulaire.
  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    getUserById(uid)
      .then((u) => !cancelled && setCurrentAddress(u.address ?? ""))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [uid]);

  // Corriger l'adresse : PATCH /users/:id la re-géocode et rattache déjà au quartier
  // qui la contient s'il est unique (step-up TOTP demandé par l'intercepteur en prod).
  // On enchaîne sur `resolve()` pour couvrir les autres cas — chevauchement (choix à
  // faire) ou toujours aucune couverture — et rafraîchir le token si c'est bon.
  const saveAddress = async () => {
    if (!uid || !address.trim() || address === currentAddress) {
      setEditingAddress(false);
      return;
    }
    setSavingAddress(true);
    setError(null);
    try {
      const updated = await updateUser(uid, { address });
      setCurrentAddress(updated.address ?? address);
      setAddress("");
      setEditingAddress(false);
      setCandidates([]);
      await resolve();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setError(e?.response?.data?.message ?? e?.message ?? t("noDistrict.error"));
    } finally {
      setSavingAddress(false);
    }
  };

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

      {currentAddress && (
        <p className="text-sm text-base-content/50">
          <span className="icon-[tabler--map-pin] me-1 size-4 align-text-bottom" />
          {currentAddress}
        </p>
      )}

      {editingAddress && (
        <div className="w-full max-w-md space-y-3 rounded-box border border-base-content/10 bg-base-100 p-4 text-left">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
              {t("noDistrict.addressLabel")}
            </span>
            <div className="mt-1">
              {/* dropUp : la liste de suggestions surplomberait sinon les boutons d'action. */}
              <AddressAutocomplete
                dropUp
                value={address}
                onChange={setAddress}
                placeholder={t("noDistrict.addressPlaceholder")}
              />
            </div>
          </label>
          <div className="flex justify-end gap-2">
            <button
              className="btn btn-soft"
              disabled={savingAddress}
              onClick={() => {
                setAddress("");
                setEditingAddress(false);
              }}
            >
              {t("common.cancel")}
            </button>
            <button className="btn btn-primary" disabled={savingAddress || !address.trim()} onClick={saveAddress}>
              {savingAddress && <span className="loading loading-spinner loading-sm" />}
              {t("noDistrict.saveAddress")}
            </button>
          </div>
        </div>
      )}

      {error && <p className="max-w-md text-sm text-error">{error}</p>}

      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        {!hasChoice && (
          <>
            <button className="btn btn-primary" disabled={busy || creating || savingAddress} onClick={createOwn}>
              {creating && <span className="loading loading-spinner loading-sm" />}
              {t("noDistrict.createOwn")}
            </button>
            <button className="btn btn-soft" disabled={busy || creating || savingAddress} onClick={() => resolve()}>
              {busy && !creating && <span className="loading loading-spinner loading-sm" />}
              {t("noDistrict.checkAgain")}
            </button>
          </>
        )}
        {!editingAddress && (
          <button
            className="btn btn-soft"
            disabled={busy || creating || savingAddress}
            onClick={() => setEditingAddress(true)}
          >
            <span className="icon-[tabler--map-pin-cog] size-4" />
            {t("noDistrict.changeAddress")}
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
