import { useState } from "react";
import { useAuth } from "@repo/hooks";
import type { CreateListingDto, ListingResponseDto } from "@repo/contracts";
import { updateListing, deleteListing } from "../api-service/listings.service";
import { createContract, viewContractPdf } from "../api-service/contracts.service";
import ListingForm from "./ListingForm";

// Carte interactive utilisée PARTOUT (Annonces + Mes annonces).
// Le composant détecte lui-même si l'annonce appartient au user connecté pour
// décider quels boutons afficher dans la modale :
//   - Owner → Modifier / Supprimer
//   - Non-owner et déjà pris → badge "Service pris", bouton désactivé
//   - Non-owner sinon → Prendre ce service (génère un contract + PDF)
type CarteServiceProps = {
  annonce: ListingResponseDto;
  onChanged?: () => void;
};

const CarteService = ({ annonce, onChanged }: CarteServiceProps) => {
  const { user } = useAuth();
  const isOwner = !!user?.id && annonce.authorId === user.id;
  // `userHasContract` est peuplé par le backend (use-case getListings) à partir
  // de la collection contracts. Si true → le user a déjà pris ce service.
  const alreadyTaken = annonce.userHasContract === true;

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // État du flux "Prendre ce service" (non-owner)
  const [taking, setTaking] = useState<boolean>(false);
  const [contractId, setContractId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<boolean>(false);

  const closeModal = () => {
    setIsOpen(false);
    setIsEditing(false);
    setActionError(null);
    setContractId(null);
  };

  const handleDelete = async () => {
    const ok = window.confirm(
      `Êtes-vous sûr de vouloir supprimer l'annonce "${annonce.title}" ? Cette action est irréversible.`,
    );
    if (!ok) return;
    try {
      await deleteListing(annonce.id);
      onChanged?.();
      closeModal();
    } catch {
      setActionError("Échec de la suppression");
    }
  };

  const handleUpdate = async (data: CreateListingDto) => {
    await updateListing(annonce.id, data);
    onChanged?.();
    closeModal();
  };

  const handleTake = async () => {
    setTaking(true);
    setActionError(null);
    try {
      const created = await createContract({
        listingId: annonce.id,
        price: annonce.price,
      });
      setContractId(created.id);
      // Trigger un refetch côté parent pour que `userHasContract` repasse à true
      // sur la prochaine card render (autres cards de la même liste peuvent être
      // affectées si plusieurs listings, mais surtout celui-ci).
      onChanged?.();
    } catch {
      setActionError(
        "Impossible de créer le contrat (déjà pris, c'est votre annonce, ou annonce introuvable).",
      );
    } finally {
      setTaking(false);
    }
  };

  const handleViewPdf = async () => {
    if (!contractId) return;
    setViewing(true);
    setActionError(null);
    try {
      await viewContractPdf(contractId);
    } catch {
      setActionError("Impossible d'ouvrir le PDF");
    } finally {
      setViewing(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
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
          // Léger style "déjà pris" pour la lisibilité dans la liste
          opacity: alreadyTaken ? 0.78 : 1,
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 600, color: "#6366f1", margin: 0 }}>
          {annonce.title}
        </h2>
        <p
          style={{
            color: "#444",
            margin: 0,
            fontSize: 13,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {annonce.description}
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
          <span style={{ background: "#f3f4f6", borderRadius: 6, padding: "2px 7px", fontSize: 12 }}>
            <strong>Prix:</strong> {annonce.price} pts
          </span>
          <span style={{ background: "#f3f4f6", borderRadius: 6, padding: "2px 7px", fontSize: 12 }}>
            {annonce.type}
          </span>
          {isOwner && (
            <span
              style={{
                background: "#dbeafe",
                color: "#1e40af",
                borderRadius: 6,
                padding: "2px 7px",
                fontSize: 12,
              }}
            >
              Mon annonce
            </span>
          )}
          {!isOwner && alreadyTaken && (
            <span
              style={{
                background: "#d1fae5",
                color: "#065f46",
                borderRadius: 6,
                padding: "2px 7px",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              ✓ Service pris
            </span>
          )}
        </div>
      </button>

      {isOpen && (
        <div
          onClick={closeModal}
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
              padding: 24,
              maxWidth: 500,
              width: "90%",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
                {isEditing ? "Modifier l'annonce" : annonce.title}
              </h2>
              <button
                type="button"
                onClick={closeModal}
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

            {isEditing ? (
              <ListingForm
                initialValues={annonce}
                onSubmit={handleUpdate}
                submitLabel="Mettre à jour"
              />
            ) : (
              <>
                <div style={{ marginBottom: 12 }}>
                  <strong>Description : </strong>
                  <p style={{ margin: "4px 0", color: "#444" }}>{annonce.description}</p>
                </div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
                  <span style={{ background: "#f3f4f6", borderRadius: 6, padding: "4px 10px", fontSize: 13 }}>
                    <strong>Prix :</strong> {annonce.price} points
                  </span>
                  <span style={{ background: "#f3f4f6", borderRadius: 6, padding: "4px 10px", fontSize: 13 }}>
                    <strong>Type :</strong> {annonce.type}
                  </span>
                  <span style={{ background: "#f3f4f6", borderRadius: 6, padding: "4px 10px", fontSize: 13 }}>
                    <strong>Statut :</strong> {annonce.status}
                  </span>
                </div>
                {annonce.tags && annonce.tags.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <strong>Tags : </strong>
                    {annonce.tags.map((t) => (
                      <span
                        key={t}
                        style={{
                          background: "#e0e7ff",
                          borderRadius: 6,
                          padding: "2px 8px",
                          fontSize: 12,
                          marginRight: 4,
                        }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}

                {/* Actions */}
                {isOwner ? (
                  <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      style={{
                        background: "#6366f1",
                        color: "#fff",
                        border: "none",
                        borderRadius: 6,
                        padding: "8px 16px",
                        cursor: "pointer",
                      }}
                    >
                      Modifier
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      style={{
                        background: "#ef4444",
                        color: "#fff",
                        border: "none",
                        borderRadius: 6,
                        padding: "8px 16px",
                        cursor: "pointer",
                      }}
                    >
                      Supprimer
                    </button>
                  </div>
                ) : alreadyTaken && !contractId ? (
                  // Déjà pris (sans flow "viens d'être pris dans cette modale")
                  <div
                    style={{
                      background: "#ecfdf5",
                      border: "1px solid #10b981",
                      borderRadius: 8,
                      padding: 12,
                      marginTop: 16,
                    }}
                  >
                    <p style={{ margin: 0, color: "#065f46", fontSize: 13 }}>
                      ✓ Vous avez déjà pris ce service. Retrouvez votre contrat dans la page{" "}
                      <strong>Mes contrats</strong>.
                    </p>
                  </div>
                ) : (
                  <div style={{ marginTop: 16 }}>
                    {!contractId ? (
                      <button
                        type="button"
                        onClick={handleTake}
                        disabled={taking}
                        style={{
                          background: "#10b981",
                          color: "#fff",
                          border: "none",
                          borderRadius: 6,
                          padding: "8px 16px",
                          cursor: "pointer",
                          opacity: taking ? 0.5 : 1,
                        }}
                      >
                        {taking ? "Création…" : `Prendre ce service (${annonce.price} pts)`}
                      </button>
                    ) : (
                      <div
                        style={{
                          background: "#ecfdf5",
                          border: "1px solid #10b981",
                          borderRadius: 8,
                          padding: 12,
                        }}
                      >
                        <p style={{ margin: "0 0 8px 0", color: "#065f46", fontSize: 13 }}>
                          ✓ Contrat créé. Tu peux maintenant l'ouvrir pour le consulter et le signer.
                        </p>
                        <button
                          type="button"
                          onClick={handleViewPdf}
                          disabled={viewing}
                          style={{
                            background: "#6366f1",
                            color: "#fff",
                            border: "none",
                            borderRadius: 6,
                            padding: "8px 16px",
                            cursor: "pointer",
                          }}
                        >
                          {viewing ? "Ouverture…" : "Voir le PDF du contrat"}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {actionError && <p style={{ color: "red", marginTop: 12 }}>{actionError}</p>}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default CarteService;
