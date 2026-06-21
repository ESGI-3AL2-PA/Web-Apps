import { useState } from "react";
import { useAuth } from "@repo/hooks";
import type { EventResponseDto } from "@repo/contracts";
import {
  markEventInterest,
  registerToEvent,
  unregisterFromEvent,
} from "../api-service/events.service";

// Carte event + modale détail. La modale expose :
//   - Inscription / désinscription
//   - Boutons 👍 / 👎 d'intérêt (alimente Neo4j pour la reco)
type CarteEventProps = {
  event: EventResponseDto;
  onChanged?: () => void;
};

const formatDate = (iso: string) => {
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
};

const CarteEvent = ({ event, onChanged }: CarteEventProps) => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [interestSent, setInterestSent] = useState<"up" | "down" | null>(null);

  const isRegistered = !!user?.id && event.registrants.includes(user.id);
  const seatsLeft = event.remainingSeats;
  const closed = event.status !== "upcoming" && event.status !== "ongoing";

  const closeModal = () => {
    setIsOpen(false);
    setError(null);
    setInterestSent(null);
  };

  const handleRegister = async () => {
    setError(null);
    setBusy(true);
    try {
      await registerToEvent(event.id);
      onChanged?.();
      closeModal();
    } catch {
      setError("Échec de l'inscription");
    } finally {
      setBusy(false);
    }
  };

  const handleUnregister = async () => {
    setError(null);
    setBusy(true);
    try {
      await unregisterFromEvent(event.id);
      onChanged?.();
      closeModal();
    } catch {
      setError("Échec de la désinscription");
    } finally {
      setBusy(false);
    }
  };

  const handleInterest = async (rating: 1 | -1) => {
    setError(null);
    setBusy(true);
    try {
      await markEventInterest(event.id, rating);
      setInterestSent(rating > 0 ? "up" : "down");
    } catch {
      setError("Échec de l'enregistrement de votre préférence");
    } finally {
      setBusy(false);
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
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 600, color: "#6366f1", margin: 0 }}>
          {event.title}
        </h2>
        <p style={{ color: "#444", margin: 0, fontSize: 13 }}>{formatDate(event.eventDate)}</p>
        <p
          style={{
            color: "#666",
            margin: 0,
            fontSize: 12,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          📍 {event.location}
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
          <span style={{ background: "#f3f4f6", borderRadius: 6, padding: "2px 7px", fontSize: 12 }}>
            {seatsLeft}/{event.totalSeats} places
          </span>
          <span style={{ background: "#f3f4f6", borderRadius: 6, padding: "2px 7px", fontSize: 12 }}>
            {event.status}
          </span>
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{event.title}</h2>
              <button
                type="button"
                onClick={closeModal}
                style={{ fontSize: 24, lineHeight: 1, background: "none", border: "none", cursor: "pointer" }}
                aria-label="Fermer"
              >
                ×
              </button>
            </div>

            <div style={{ marginBottom: 12 }}>
              <strong>Description :</strong>
              <p style={{ margin: "4px 0", color: "#444" }}>{event.description}</p>
            </div>

            <div style={{ marginBottom: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
              <span style={{ background: "#f3f4f6", borderRadius: 6, padding: "4px 10px", fontSize: 13 }}>
                📅 {formatDate(event.eventDate)}
              </span>
              <span style={{ background: "#f3f4f6", borderRadius: 6, padding: "4px 10px", fontSize: 13 }}>
                📍 {event.location}
              </span>
              <span style={{ background: "#f3f4f6", borderRadius: 6, padding: "4px 10px", fontSize: 13 }}>
                👥 {seatsLeft}/{event.totalSeats} places
              </span>
              <span style={{ background: "#f3f4f6", borderRadius: 6, padding: "4px 10px", fontSize: 13 }}>
                <strong>Statut :</strong> {event.status}
              </span>
            </div>

            {/* Boutons inscription */}
            {!closed && (
              <div style={{ display: "flex", gap: 8, marginTop: 16, marginBottom: 12 }}>
                {isRegistered ? (
                  <button
                    type="button"
                    onClick={handleUnregister}
                    disabled={busy}
                    style={{
                      background: "#ef4444",
                      color: "#fff",
                      border: "none",
                      borderRadius: 6,
                      padding: "8px 16px",
                      cursor: "pointer",
                      opacity: busy ? 0.5 : 1,
                    }}
                  >
                    {busy ? "…" : "Se désinscrire"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleRegister}
                    disabled={busy || seatsLeft <= 0}
                    style={{
                      background: seatsLeft > 0 ? "#10b981" : "#9ca3af",
                      color: "#fff",
                      border: "none",
                      borderRadius: 6,
                      padding: "8px 16px",
                      cursor: seatsLeft > 0 ? "pointer" : "not-allowed",
                      opacity: busy ? 0.5 : 1,
                    }}
                  >
                    {busy ? "…" : seatsLeft > 0 ? "S'inscrire" : "Complet"}
                  </button>
                )}
              </div>
            )}

            {/* Boutons intérêt (alimentent la reco Neo4j) */}
            <div style={{ borderTop: "1px solid #eee", paddingTop: 12, marginTop: 8 }}>
              <p style={{ fontSize: 13, color: "#666", marginBottom: 8 }}>
                Cet événement vous intéresse-t-il ? Vos préférences améliorent vos suggestions.
              </p>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button
                  type="button"
                  onClick={() => handleInterest(1)}
                  disabled={busy}
                  style={{
                    background: interestSent === "up" ? "#10b981" : "#f3f4f6",
                    color: interestSent === "up" ? "#fff" : "#111",
                    border: "1px solid #d1d5db",
                    borderRadius: 6,
                    padding: "6px 14px",
                    cursor: "pointer",
                    fontSize: 18,
                    opacity: busy ? 0.5 : 1,
                  }}
                  aria-label="Intéressé"
                >
                  👍
                </button>
                <button
                  type="button"
                  onClick={() => handleInterest(-1)}
                  disabled={busy}
                  style={{
                    background: interestSent === "down" ? "#ef4444" : "#f3f4f6",
                    color: interestSent === "down" ? "#fff" : "#111",
                    border: "1px solid #d1d5db",
                    borderRadius: 6,
                    padding: "6px 14px",
                    cursor: "pointer",
                    fontSize: 18,
                    opacity: busy ? 0.5 : 1,
                  }}
                  aria-label="Pas intéressé"
                >
                  👎
                </button>
                {interestSent && (
                  <span style={{ fontSize: 12, color: "#666" }}>Préférence enregistrée ✓</span>
                )}
              </div>
            </div>

            {error && <p style={{ color: "red", marginTop: 12 }}>{error}</p>}
          </div>
        </div>
      )}
    </>
  );
};

export default CarteEvent;
