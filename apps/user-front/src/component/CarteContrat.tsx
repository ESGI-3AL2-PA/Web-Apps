import { useState } from "react";
import { useAuth } from "@repo/hooks";
import type { ContractResponseDto } from "@repo/contracts";
import ContractDetailModal from "./ContractDetailModal";

// Carte compacte d'un contract. Click → ouvre la modale détail.
type CarteContratProps = {
  contract: ContractResponseDto;
  onChanged?: () => void;
};

// Couleur du badge selon le statut signature.
const STATUS_STYLES: Record<string, { bg: string; fg: string; label: string }> = {
  draft: { bg: "#f3f4f6", fg: "#111", label: "Brouillon" },
  sent: { bg: "#dbeafe", fg: "#1e40af", label: "À signer" },
  partially_signed: { bg: "#fef3c7", fg: "#92400e", label: "Partiellement signé" },
  signed: { bg: "#d1fae5", fg: "#065f46", label: "Signé" },
  expired: { bg: "#e5e7eb", fg: "#374151", label: "Expiré" },
  declined: { bg: "#fee2e2", fg: "#991b1b", label: "Refusé" },
};

const formatDate = (iso: string) => {
  try {
    return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(iso));
  } catch {
    return iso;
  }
};

const CarteContrat = ({ contract, onChanged }: CarteContratProps) => {
  const { user } = useAuth();
  const [open, setOpen] = useState<boolean>(false);

  const isProvider = !!user?.id && contract.providerId === user.id;
  const myRole = isProvider ? "Prestataire" : "Bénéficiaire";

  const status = STATUS_STYLES[contract.openSignStatus] ?? STATUS_STYLES.draft;
  const shortId = contract.id.slice(0, 8);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          background: "#fff",
          borderRadius: 10,
          boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
          padding: 14,
          display: "flex",
          flexDirection: "column",
          gap: 6,
          border: "1px solid #eee",
          textAlign: "left",
          cursor: "pointer",
        }}
      >
        <h2 style={{ fontSize: 15, fontWeight: 600, color: "#6366f1", margin: 0 }}>
          Contrat #{shortId}
        </h2>
        <p style={{ color: "#666", margin: 0, fontSize: 12 }}>
          Créé le {formatDate(contract.createdAt)}
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
          <span style={{ background: "#f3f4f6", borderRadius: 6, padding: "2px 7px", fontSize: 12 }}>
            {contract.price} pts
          </span>
          <span
            style={{
              background: isProvider ? "#dbeafe" : "#e0e7ff",
              color: isProvider ? "#1e40af" : "#3730a3",
              borderRadius: 6,
              padding: "2px 7px",
              fontSize: 12,
            }}
          >
            {myRole}
          </span>
          <span
            style={{
              background: status.bg,
              color: status.fg,
              borderRadius: 6,
              padding: "2px 7px",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {status.label}
          </span>
          {contract.disputed && (
            <span
              style={{
                background: "#fee2e2",
                color: "#991b1b",
                borderRadius: 6,
                padding: "2px 7px",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              ⚠ Litige
            </span>
          )}
        </div>
      </button>

      {open && (
        <ContractDetailModal
          contract={contract}
          onClose={() => setOpen(false)}
          onChanged={onChanged}
        />
      )}
    </>
  );
};

export default CarteContrat;
