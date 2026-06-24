import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@repo/hooks";
import type { ContractQueryDto, ContractResponseDto, OpenSignStatus } from "@repo/contracts";
import { getContracts } from "../../api-service/contracts.service";
import CarteContrat from "../../component/CarteContrat";

type RoleFilter = "all" | "provider" | "beneficiary";

const STATUS_OPTIONS: { value: OpenSignStatus | ""; label: string }[] = [
  { value: "", label: "Tous statuts" },
  { value: "draft", label: "Brouillon" },
  { value: "sent", label: "À signer" },
  { value: "partially_signed", label: "Partiellement signé" },
  { value: "signed", label: "Signé" },
  { value: "expired", label: "Expiré" },
  { value: "declined", label: "Refusé" },
];

// Page "Mes contrats" — liste les contrats où le user est partie (provider OU
// beneficiary). Le backend filtre automatiquement par partyId=req.user.sub
// pour les non-admins, donc on appelle juste getContracts() sans paramètres.
// Le filtre rôle (Prestataire / Bénéficiaire) se fait côté front.
const Contrat = () => {
  const { user } = useAuth();
  const [contracts, setContracts] = useState<ContractResponseDto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<RoleFilter>("all");
  const [status, setStatus] = useState<OpenSignStatus | "">("");
  const [showDisputed, setShowDisputed] = useState<boolean>(false);

  const fetchContracts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filters: ContractQueryDto = { limit: 50 } as ContractQueryDto;
      if (status) filters.openSignStatus = status;
      if (showDisputed) filters.disputed = true;
      const res = await getContracts(filters);
      setContracts(res.data);
    } catch {
      setError("Impossible de charger les contrats");
    } finally {
      setLoading(false);
    }
  }, [status, showDisputed]);

  useEffect(() => {
    fetchContracts();
  }, [fetchContracts]);

  // Filtre rôle côté front (les non-admins ne peuvent pas filtrer providerId/
  // beneficiaryId côté backend — ils reçoivent tout ce qui les concerne).
  const filteredContracts = useMemo(() => {
    if (role === "all" || !user?.id) return contracts;
    if (role === "provider") return contracts.filter((c) => c.providerId === user.id);
    return contracts.filter((c) => c.beneficiaryId === user.id);
  }, [contracts, role, user?.id]);

  if (!user?.id) return <div style={{ padding: 24 }}>Connexion requise.</div>;

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 30, fontWeight: 700, margin: "0 0 24px 0" }}>Mes contrats</h1>

      {/* Filtres */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap", alignItems: "center" }}>
        <select
          className="border border-black rounded px-2 py-1"
          value={role}
          onChange={(e) => setRole(e.target.value as RoleFilter)}
        >
          <option value="all">Tous rôles</option>
          <option value="provider">En tant que prestataire</option>
          <option value="beneficiary">En tant que bénéficiaire</option>
        </select>

        <select
          className="border border-black rounded px-2 py-1"
          value={status}
          onChange={(e) => setStatus(e.target.value as OpenSignStatus | "")}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value || "all"} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          <input
            type="checkbox"
            checked={showDisputed}
            onChange={(e) => setShowDisputed(e.target.checked)}
          />
          Litigieux uniquement
        </label>
      </div>

      {/* Contenu */}
      {loading ? (
        <p>Chargement des contrats…</p>
      ) : error ? (
        <p style={{ color: "red" }}>{error}</p>
      ) : filteredContracts.length === 0 ? (
        <p style={{ color: "#666" }}>
          Aucun contrat. Va sur l'onglet <strong>Annonces</strong> et clique sur "Prendre ce service" pour en
          créer un.
        </p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 16,
          }}
        >
          {filteredContracts.map((c) => (
            <CarteContrat key={c.id} contract={c} onChanged={fetchContracts} />
          ))}
        </div>
      )}
    </div>
  );
};

export default Contrat;
