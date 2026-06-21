import { useState } from "react";
import type { CreateListingDto, ListingResponseDto } from "@repo/contracts";
import { updateListing, deleteListing } from "../api-service/listings.service";
import ListingForm from "./ListingForm";

// Carte interactive : affichage compact identique à `AnnoncesCard`, puis sur
// click ouvre une modale avec les détails. Si `editable=true`, la modale
// expose 2 boutons (Modifier / Supprimer).
type CarteServiceProps = {
  annonce: ListingResponseDto;
  editable?: boolean;
  onChanged?: () => void;
};

const CarteService = ({ annonce, editable = false, onChanged }: CarteServiceProps) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const closeModal = () => {
    setIsOpen(false);
    setIsEditing(false);
    setActionError(null);
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
    // updateListing prend UpdateListingDto, qui accepte les mêmes champs que
    // CreateListingDto en optional → on peut passer le payload tel quel.
    await updateListing(annonce.id, data);
    onChanged?.();
    closeModal();
  };

  return (
    <>
      {/* Carte cliquable (le visuel reprend le style d'AnnoncesCard) */}
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
            <strong>Prix:</strong> {annonce.price} €
          </span>
          <span style={{ background: "#f3f4f6", borderRadius: 6, padding: "2px 7px", fontSize: 12 }}>
            {annonce.type}
          </span>
        </div>
      </button>

      {/* Modale */}
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
            {/* Header de la modale */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
                {isEditing ? "Modifier l'annonce" : annonce.title}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                style={{ fontSize: 24, lineHeight: 1, background: "none", border: "none", cursor: "pointer" }}
                aria-label="Fermer"
              >
                ×
              </button>
            </div>

            {isEditing ? (
              // Vue édition
              <ListingForm
                initialValues={annonce}
                onSubmit={handleUpdate}
                submitLabel="Mettre à jour"
              />
            ) : (
              // Vue détails
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

                {/* Boutons d'action (uniquement si editable) */}
                {editable && (
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
