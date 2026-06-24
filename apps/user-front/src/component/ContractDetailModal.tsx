import { useEffect, useState } from "react";
import { useAuth } from "@repo/hooks";
import type { ContractResponseDto } from "@repo/contracts";
import {
  deleteContract,
  disputeContract,
  fetchContractPdfBlob,
  signContract,
  viewContractPdf,
} from "../api-service/contracts.service";
import SignaturePad from "./SignaturePad";

type ContractDetailModalProps = {
  contract: ContractResponseDto;
  onClose: () => void;
  onChanged?: () => void;
};

const formatDate = (iso: string) => {
  try {
    return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" }).format(
      new Date(iso),
    );
  } catch {
    return iso;
  }
};

const ContractDetailModal = ({ contract, onClose, onChanged }: ContractDetailModalProps) => {
  const { user } = useAuth();
  const [localContract, setLocalContract] = useState<ContractResponseDto>(contract);

  const isProvider = !!user?.id && localContract.providerId === user.id;
  const isBeneficiary = !!user?.id && localContract.beneficiaryId === user.id;
  const myRole = isProvider ? "Prestataire" : "Bénéficiaire";

  // A déjà signé ?
  const meAlreadySigned =
    (isProvider && !!localContract.providerSignedAt) ||
    (isBeneficiary && !!localContract.beneficiarySignedAt);
  const canSign =
    !meAlreadySigned &&
    !localContract.disputed &&
    localContract.openSignStatus !== "expired" &&
    localContract.openSignStatus !== "declined" &&
    localContract.openSignStatus !== "signed";

  // PDF inline via blob URL.
  const [pdfUrl, setPdfUrl] = useState<string>("");
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState<boolean>(true);

  // Reload du PDF quand le contract change (notamment après signature pour voir
  // la version freshly signed).
  const [pdfReloadKey, setPdfReloadKey] = useState<number>(0);

  // Signature UI
  const [showSignPad, setShowSignPad] = useState<boolean>(false);
  const [signing, setSigning] = useState<boolean>(false);

  // Dispute UI
  const [showDispute, setShowDispute] = useState<boolean>(false);
  const [disputeReason, setDisputeReason] = useState<string>("");
  const [disputing, setDisputing] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  useEffect(() => {
    let createdUrl: string | null = null;
    setPdfLoading(true);
    setPdfError(null);
    fetchContractPdfBlob(localContract.id)
      .then((blob) => {
        createdUrl = URL.createObjectURL(blob);
        setPdfUrl(createdUrl);
      })
      .catch(() => setPdfError("Impossible de charger le PDF"))
      .finally(() => setPdfLoading(false));

    return () => {
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [localContract.id, pdfReloadKey]);

  const handleDownload = async () => {
    setActionError(null);
    try {
      await viewContractPdf(localContract.id);
    } catch {
      setActionError("Impossible de télécharger le PDF");
    }
  };

  const handleDispute = async () => {
    if (disputeReason.trim().length === 0) {
      setActionError("Donne une raison");
      return;
    }
    setDisputing(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await disputeContract(localContract.id, { reason: disputeReason.trim() });
      setActionSuccess("Litige enregistré. Le contrat est désormais marqué.");
      setShowDispute(false);
      setDisputeReason("");
      onChanged?.();
    } catch {
      setActionError("Échec de l'enregistrement du litige");
    } finally {
      setDisputing(false);
    }
  };

  const handleSign = async (dataUrl: string) => {
    setSigning(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const updated = await signContract(localContract.id, { signatureImage: dataUrl });
      setLocalContract(updated);
      setShowSignPad(false);
      setActionSuccess(
        updated.openSignStatus === "signed"
          ? "Contrat entièrement signé ✓ par les 2 parties"
          : "Votre signature est enregistrée. En attente de la 2e partie.",
      );
      // Refresh PDF
      setPdfReloadKey((k) => k + 1);
      onChanged?.();
    } catch {
      setActionError(
        "Échec de la signature (vous avez peut-être déjà signé, ou le contrat est clos).",
      );
    } finally {
      setSigning(false);
    }
  };

  const canDispute =
    !localContract.disputed && localContract.openSignStatus !== "expired";
  // On autorise la suppression tant que le contrat n'est pas entièrement signé
  // (RGPD : tu peux toujours retirer un brouillon, mais pas effacer une preuve
  // de signature finale unilatéralement). À ajuster selon ta politique.
  const canDelete = localContract.openSignStatus !== "signed";

  const handleDelete = async () => {
    const ok = window.confirm(
      "Supprimer ce contrat ? Le PDF associé sera également supprimé du serveur. Cette action est irréversible.",
    );
    if (!ok) return;
    setActionError(null);
    try {
      await deleteContract(localContract.id);
      onChanged?.();
      onClose();
    } catch {
      setActionError("Échec de la suppression du contrat");
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 10,
          padding: 20,
          maxWidth: 900,
          width: "95%",
          maxHeight: "92vh",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
              Contrat #{localContract.id.slice(0, 8)}
            </h2>
            <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "#666" }}>
              Créé le {formatDate(localContract.createdAt)} · Rôle : <strong>{myRole}</strong> ·{" "}
              <strong>{localContract.price} points</strong>
              {localContract.disputed && (
                <span style={{ color: "#991b1b", marginLeft: 8 }}>⚠ Litige en cours</span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              fontSize: 24,
              lineHeight: 1,
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        {/* État des signatures */}
        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            background: "#f9fafb",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            padding: 10,
            fontSize: 12,
          }}
        >
          <span>
            <strong>Prestataire :</strong>{" "}
            {localContract.providerSignedAt ? (
              <span style={{ color: "#065f46" }}>
                ✓ Signé le {formatDate(localContract.providerSignedAt)}
              </span>
            ) : (
              <span style={{ color: "#92400e" }}>En attente</span>
            )}
          </span>
          <span>
            <strong>Bénéficiaire :</strong>{" "}
            {localContract.beneficiarySignedAt ? (
              <span style={{ color: "#065f46" }}>
                ✓ Signé le {formatDate(localContract.beneficiarySignedAt)}
              </span>
            ) : (
              <span style={{ color: "#92400e" }}>En attente</span>
            )}
          </span>
        </div>

        {/* PDF viewer inline */}
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            overflow: "hidden",
            background: "#f3f4f6",
            minHeight: 420,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {pdfLoading ? (
            <p style={{ color: "#666" }}>Chargement du PDF…</p>
          ) : pdfError ? (
            <p style={{ color: "red" }}>{pdfError}</p>
          ) : (
            <iframe
              key={pdfReloadKey}
              src={pdfUrl}
              title={`Contrat ${localContract.id}`}
              style={{ width: "100%", height: 500, border: "none" }}
            />
          )}
        </div>

        {/* Actions principales */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={handleDownload}
            style={{
              background: "#6366f1",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              padding: "8px 16px",
              cursor: "pointer",
            }}
          >
            Ouvrir dans un nouvel onglet
          </button>

          {canSign && !showSignPad && (
            <button
              type="button"
              onClick={() => setShowSignPad(true)}
              style={{
                background: "#10b981",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                padding: "8px 16px",
                cursor: "pointer",
              }}
            >
              🖋️ Signer le contrat
            </button>
          )}

          {meAlreadySigned && localContract.openSignStatus !== "signed" && (
            <span
              style={{
                background: "#d1fae5",
                color: "#065f46",
                borderRadius: 6,
                padding: "8px 12px",
                fontSize: 13,
              }}
            >
              ✓ Vous avez signé — en attente de l'autre partie
            </span>
          )}

          {localContract.openSignStatus === "signed" && (
            <span
              style={{
                background: "#d1fae5",
                color: "#065f46",
                borderRadius: 6,
                padding: "8px 12px",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              ✓ Contrat entièrement signé
            </span>
          )}

          {canDispute && !showDispute && (
            <button
              type="button"
              onClick={() => setShowDispute(true)}
              style={{
                background: "#ef4444",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                padding: "8px 16px",
                cursor: "pointer",
              }}
            >
              Marquer en litige
            </button>
          )}

          {canDelete && (
            <button
              type="button"
              onClick={handleDelete}
              style={{
                background: "transparent",
                color: "#7f1d1d",
                border: "1px solid #fca5a5",
                borderRadius: 6,
                padding: "8px 16px",
                cursor: "pointer",
              }}
              title="Supprime le contrat + son PDF du serveur (RGPD)"
            >
              🗑 Supprimer
            </button>
          )}
        </div>

        {/* SignaturePad inline */}
        {showSignPad && (
          <div
            style={{
              background: "#f0f9ff",
              border: "1px solid #93c5fd",
              borderRadius: 8,
              padding: 12,
            }}
          >
            <p style={{ fontSize: 13, fontWeight: 600, color: "#1e40af", marginTop: 0 }}>
              Apposez votre signature ({myRole})
            </p>
            <SignaturePad
              onSubmit={handleSign}
              onCancel={() => setShowSignPad(false)}
              submitLabel={signing ? "Envoi…" : "Apposer ma signature"}
            />
          </div>
        )}

        {/* Formulaire dispute */}
        {showDispute && (
          <div
            style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: 8,
              padding: 12,
            }}
          >
            <label
              htmlFor="dispute-reason"
              style={{ fontSize: 13, fontWeight: 600, color: "#7f1d1d" }}
            >
              Raison du litige :
            </label>
            <textarea
              id="dispute-reason"
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              rows={3}
              style={{
                width: "100%",
                marginTop: 6,
                padding: 8,
                border: "1px solid #fca5a5",
                borderRadius: 6,
                fontSize: 13,
                resize: "vertical",
              }}
              placeholder="Décris brièvement le problème…"
            />
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button
                type="button"
                onClick={handleDispute}
                disabled={disputing}
                style={{
                  background: "#dc2626",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  padding: "6px 14px",
                  cursor: "pointer",
                  fontSize: 13,
                  opacity: disputing ? 0.5 : 1,
                }}
              >
                {disputing ? "Envoi…" : "Confirmer le litige"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDispute(false);
                  setDisputeReason("");
                }}
                style={{
                  background: "#f3f4f6",
                  color: "#111",
                  border: "1px solid #d1d5db",
                  borderRadius: 6,
                  padding: "6px 14px",
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                Annuler
              </button>
            </div>
          </div>
        )}

        {actionSuccess && <p style={{ color: "#10b981", fontSize: 13, margin: 0 }}>{actionSuccess}</p>}
        {actionError && <p style={{ color: "red", fontSize: 13, margin: 0 }}>{actionError}</p>}
      </div>
    </div>
  );
};

export default ContractDetailModal;
