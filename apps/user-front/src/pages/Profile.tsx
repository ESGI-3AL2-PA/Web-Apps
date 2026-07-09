import { useEffect, useState } from "react";
import { useAuth } from "@repo/hooks";
import type {
  UserResponseDto,
  ListingQueryDto,
  EventQueryDto,
  VoteQueryDto,
  TransactionQueryDto,
} from "@repo/contracts";
import { getUserById, updateUser, deleteUser } from "../api-service/users.service";
import { getDistrictById } from "../api-service/districts.service";
import { getUserBalance, getUserTransactions } from "../api-service/transactions.service";
import { getListings } from "../api-service/listings.service";
import { getContracts } from "../api-service/contracts.service";
import { getEvents } from "../api-service/events.service";
import { getVotes } from "../api-service/votes.service";

type EditForm = {
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
};

const Profile = () => {
  const { user, logout } = useAuth();

  const [fullUser, setFullUser] = useState<UserResponseDto | null>(null);
  const [districtName, setDistrictName] = useState<string>("");
  const [balance, setBalance] = useState<number | null>(null);
  const [stats, setStats] = useState({ listings: 0, contracts: 0, events: 0, votes: 0 });
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<EditForm>({ firstName: "", lastName: "", phone: "", address: "" });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const u = await getUserById(user.id);
        if (cancelled) return;
        setFullUser(u);
        setForm({
          firstName: u.firstName,
          lastName: u.lastName,
          phone: u.phone ?? "",
          address: u.address ?? "",
        });
        if (u.districtId) {
          getDistrictById(u.districtId)
            .then((d) => !cancelled && setDistrictName(d.name))
            .catch(() => !cancelled && setDistrictName(""));
        }
      } catch {
        if (!cancelled) setError("Impossible de charger le profil");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    getUserBalance(user.id)
      .then((r) => !cancelled && setBalance(r.balance))
      .catch(() => !cancelled && setBalance(null));
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const [listingsRes, contractsProvider, contractsBenef, eventsRes, votesRes] = await Promise.all([
          getListings({ authorId: user.id, limit: 1 } as ListingQueryDto),
          getContracts({ providerId: user.id, limit: 1 }),
          getContracts({ beneficiaryId: user.id, limit: 1 }),
          getEvents({ creatorId: user.id, limit: 1 } as EventQueryDto),
          getVotes({ creatorId: user.id, limit: 1 } as VoteQueryDto),
        ]);
        if (cancelled) return;
        setStats({
          listings: listingsRes.total,
          contracts: contractsProvider.total + contractsBenef.total,
          events: eventsRes.total,
          votes: votesRes.total,
        });
      } catch {
        // stats best-effort, on laisse les zéros
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const handleCopyId = async () => {
    if (!user?.id) return;
    try {
      await navigator.clipboard.writeText(user.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Impossible de copier dans le presse-papier");
    }
  };

  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);
    setError("");
    try {
      const updated = await updateUser(user.id, {
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone || undefined,
        address: form.address || undefined,
      });
      setFullUser(updated);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    if (fullUser) {
      setForm({
        firstName: fullUser.firstName,
        lastName: fullUser.lastName,
        phone: fullUser.phone ?? "",
        address: fullUser.address ?? "",
      });
    }
    setEditing(false);
    setError("");
  };

  const handleExportRgpd = async () => {
    if (!user?.id) return;
    setExporting(true);
    try {
      const [profile, listingsRes, contractsP, contractsB, eventsRes, votesRes, txRes] = await Promise.all([
        getUserById(user.id),
        getListings({ authorId: user.id, limit: 200 } as ListingQueryDto).catch(() => ({ data: [] })),
        getContracts({ providerId: user.id, limit: 200 }).catch(() => ({ data: [] })),
        getContracts({ beneficiaryId: user.id, limit: 200 }).catch(() => ({ data: [] })),
        getEvents({ creatorId: user.id, limit: 200 } as EventQueryDto).catch(() => ({ data: [] })),
        getVotes({ creatorId: user.id, limit: 200 } as VoteQueryDto).catch(() => ({ data: [] })),
        getUserTransactions(user.id, { limit: 500 } as TransactionQueryDto).catch(() => ({ data: [] })),
      ]);
      const payload = {
        exportedAt: new Date().toISOString(),
        profile,
        listings: listingsRes.data,
        contractsAsProvider: contractsP.data,
        contractsAsBeneficiary: contractsB.data,
        events: eventsRes.data,
        votes: votesRes.data,
        transactions: txRes.data,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mes-donnees-${user.id.slice(0, 8)}-${Date.now()}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch {
      setError("Erreur lors de l'export de vos données");
    } finally {
      setExporting(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    window.location.href = "/";
  };

  const handleDeleteAccount = async () => {
    if (!user?.id || deleteInput !== "SUPPRIMER") return;
    try {
      await deleteUser(user.id);
      await logout();
      window.location.href = "/";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors de la suppression");
      setConfirmDelete(false);
    }
  };

  if (!user) {
    return <div className="p-8">Chargement…</div>;
  }

  return (
    <div className="max-w-3xl mx-auto py-8 space-y-6">
      <h1 className="text-3xl font-bold flex items-center gap-2">👤 Mon profil</h1>

      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      )}

      <section className="card bg-base-100 shadow border border-black/10">
        <div className="card-body">
          <h2 className="card-title text-lg">🆔 Mon identifiant</h2>
          <p className="text-sm text-base-content/70">
            {"Partage ton ID avec un voisin pour qu'il puisse t'ajouter en messagerie."}
          </p>
          <div className="flex gap-2 items-center">
            <code className="flex-1 px-3 py-2 bg-base-200 rounded text-sm break-all">{user.id}</code>
            <button className="btn btn-sm btn-primary" onClick={handleCopyId}>
              {copied ? "✓ Copié" : "📋 Copier"}
            </button>
          </div>
        </div>
      </section>

      <section className="card bg-base-100 shadow border border-black/10">
        <div className="card-body">
          <div className="flex justify-between items-center">
            <h2 className="card-title text-lg">✏️ Mes informations</h2>
            {!editing && (
              <button className="btn btn-sm btn-outline" onClick={() => setEditing(true)}>
                Modifier
              </button>
            )}
          </div>

          {!editing ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <Info label="Prénom" value={fullUser?.firstName ?? user.firstName} />
              <Info label="Nom" value={fullUser?.lastName ?? user.lastName} />
              <Info label="Email" value={fullUser?.email ?? user.email} />
              <Info label="Téléphone" value={fullUser?.phone ?? "—"} />
              <Info label="Adresse" value={fullUser?.address ?? "—"} />
              <Info label="Quartier" value={districtName || (fullUser?.districtId ? "Chargement…" : "—")} />
              <Info label="Rôle" value={fullUser?.role ?? user.role} />
            </div>
          ) : (
            <div className="space-y-3 mt-3">
              <Field label="Prénom" value={form.firstName} onChange={(v) => setForm({ ...form, firstName: v })} />
              <Field label="Nom" value={form.lastName} onChange={(v) => setForm({ ...form, lastName: v })} />
              <Field label="Téléphone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
              <Field label="Adresse" value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
              <div className="flex gap-2 justify-end">
                <button className="btn btn-ghost" onClick={handleCancelEdit} disabled={saving}>
                  Annuler
                </button>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? "Enregistrement…" : "Enregistrer"}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="card bg-base-100 shadow border border-black/10">
        <div className="card-body">
          <h2 className="card-title text-lg">📊 Mes statistiques</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
            <StatCard label="Services" value={stats.listings} icon="📋" />
            <StatCard label="Contrats" value={stats.contracts} icon="📝" />
            <StatCard label="Événements" value={stats.events} icon="🎉" />
            <StatCard label="Votes" value={stats.votes} icon="🗳️" />
          </div>
        </div>
      </section>

      <section className="card bg-base-100 shadow border border-black/10">
        <div className="card-body">
          <h2 className="card-title text-lg">💎 Mes points</h2>
          <p className="text-4xl font-bold text-primary">{balance ?? "…"}</p>
          <p className="text-sm text-base-content/60">Utilisable pour rémunérer un service entre voisins.</p>
        </div>
      </section>

      <section className="card bg-base-100 shadow border border-black/10">
        <div className="card-body">
          <h2 className="card-title text-lg">🛡️ Mes données (RGPD)</h2>
          <p className="text-sm text-base-content/70">
            {"Tu peux télécharger l'intégralité de tes données personnelles dans un fichier JSON."}
          </p>
          <button className="btn btn-outline mt-2" onClick={handleExportRgpd} disabled={exporting}>
            {exporting ? "Export en cours…" : "📥 Télécharger mes données"}
          </button>
        </div>
      </section>

      <section className="card bg-base-100 border border-red-200 shadow">
        <div className="card-body">
          <h2 className="card-title text-lg text-red-600">Zone sensible</h2>
          <div className="flex flex-col sm:flex-row gap-2 mt-2">
            <button className="btn btn-warning flex-1" onClick={handleLogout}>
              🚪 Se déconnecter
            </button>
            <button className="btn btn-error flex-1" onClick={() => setConfirmDelete(true)}>
              🗑️ Supprimer mon compte
            </button>
          </div>
        </div>
      </section>

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 space-y-4">
            <h3 className="text-xl font-bold text-red-600">Supprimer définitivement votre compte ?</h3>
            <p className="text-sm">
              Cette action est <strong>irréversible</strong>. Toutes vos données (annonces, contrats, messages…) seront
              supprimées. Tapez <strong>SUPPRIMER</strong> pour confirmer.
            </p>
            <input
              type="text"
              className="input input-bordered w-full"
              placeholder="SUPPRIMER"
              aria-label="Tapez SUPPRIMER pour confirmer la suppression du compte"
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setConfirmDelete(false);
                  setDeleteInput("");
                }}
              >
                Annuler
              </button>
              <button className="btn btn-error" disabled={deleteInput !== "SUPPRIMER"} onClick={handleDeleteAccount}>
                Confirmer la suppression
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Info = ({ label, value }: { label: string; value: string }) => (
  <div>
    <div className="text-xs uppercase text-base-content/50">{label}</div>
    <div className="text-base">{value}</div>
  </div>
);

const Field = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
  <div>
    <label className="text-xs uppercase text-base-content/60">{label}</label>
    <input
      type="text"
      className="input input-bordered w-full mt-1"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  </div>
);

const StatCard = ({ label, value, icon }: { label: string; value: number; icon: string }) => (
  <div className="bg-base-200 rounded-lg p-3 text-center">
    <div className="text-2xl">{icon}</div>
    <div className="text-2xl font-bold">{value}</div>
    <div className="text-xs text-base-content/60">{label}</div>
  </div>
);

export default Profile;
