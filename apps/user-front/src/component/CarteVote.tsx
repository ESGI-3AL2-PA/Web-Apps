import { useMemo, useState } from "react";
import type { VoteResponseDto } from "@repo/contracts";
import { getVoteById, submitVoteResponse } from "../api-service/votes.service";

// Carte cliquable + modale détail d'un vote.
// La modale propose :
//   - Si vote ouvert : radio buttons + bouton "Voter" + résultats
//   - Si vote clos / brouillon : juste les résultats (lecture seule)
type CarteVoteProps = {
  vote: VoteResponseDto;
  onChanged?: () => void;
};

const formatDate = (iso: string) => {
  try {
    return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(iso));
  } catch {
    return iso;
  }
};

const CarteVote = ({ vote, onChanged }: CarteVoteProps) => {
  const [open, setOpen] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  // État local pour afficher des résultats à jour sans devoir refetch
  // toute la liste depuis le parent (on enrichit la copie locale après vote).
  const [localVote, setLocalVote] = useState<VoteResponseDto>(vote);
  const [chosen, setChosen] = useState<string>("");

  const total = useMemo(
    () => localVote.results.reduce((sum, r) => sum + r.count, 0),
    [localVote.results],
  );

  const closed = localVote.status !== "open";

  const closeModal = () => {
    setOpen(false);
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chosen) {
      setError("Choisis une option avant de voter");
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await submitVoteResponse(localVote.id, { chosenOption: chosen });
      // Refetch le vote pour avoir les `results` à jour côté serveur.
      const fresh = await getVoteById(localVote.id);
      setLocalVote(fresh);
      setSuccess("Vote enregistré ✓");
      onChanged?.();
    } catch {
      // Le backend rejette si l'user a déjà voté → message générique.
      setError("Échec du vote (peut-être déjà voté ?)");
    } finally {
      setBusy(false);
    }
  };

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
          {localVote.question}
        </h2>
        <p style={{ color: "#666", margin: 0, fontSize: 12 }}>Jusqu'au {formatDate(localVote.endDate)}</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
          <span style={{ background: "#f3f4f6", borderRadius: 6, padding: "2px 7px", fontSize: 12 }}>
            {total} réponse{total > 1 ? "s" : ""}
          </span>
          <span style={{ background: "#f3f4f6", borderRadius: 6, padding: "2px 7px", fontSize: 12 }}>
            {localVote.status}
          </span>
        </div>
      </button>

      {open && (
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
              maxWidth: 540,
              width: "90%",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{localVote.question}</h2>
              <button
                type="button"
                onClick={closeModal}
                style={{ fontSize: 24, lineHeight: 1, background: "none", border: "none", cursor: "pointer" }}
                aria-label="Fermer"
              >
                ×
              </button>
            </div>

            <p style={{ fontSize: 12, color: "#666", marginBottom: 16 }}>
              Statut : <strong>{localVote.status}</strong> · Jusqu'au {formatDate(localVote.endDate)} ·{" "}
              {total} réponse{total > 1 ? "s" : ""}
            </p>

            {/* Formulaire de vote (si ouvert) */}
            {!closed && (
              <form onSubmit={handleSubmit} style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                  {localVote.options.map((opt) => (
                    <label
                      key={opt}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: 8,
                        border: "1px solid #e5e7eb",
                        borderRadius: 6,
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="radio"
                        name="chosen"
                        value={opt}
                        checked={chosen === opt}
                        onChange={() => setChosen(opt)}
                      />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
                <button
                  type="submit"
                  disabled={busy || !chosen}
                  style={{
                    background: chosen ? "#6366f1" : "#9ca3af",
                    color: "#fff",
                    border: "none",
                    borderRadius: 6,
                    padding: "8px 16px",
                    cursor: chosen ? "pointer" : "not-allowed",
                    opacity: busy ? 0.5 : 1,
                  }}
                >
                  {busy ? "Envoi…" : "Voter"}
                </button>
              </form>
            )}

            {/* Résultats — barres horizontales */}
            <div style={{ borderTop: "1px solid #eee", paddingTop: 12 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 10px 0" }}>Résultats</h3>
              {total === 0 ? (
                <p style={{ color: "#666", fontSize: 13 }}>Aucun vote pour l'instant.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {localVote.options.map((opt) => {
                    const entry = localVote.results.find((r) => r.option === opt);
                    const count = entry?.count ?? 0;
                    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                    return (
                      <div key={opt}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 2 }}>
                          <span>{opt}</span>
                          <span style={{ color: "#666" }}>
                            {count} ({pct}%)
                          </span>
                        </div>
                        <div style={{ background: "#f3f4f6", height: 8, borderRadius: 4, overflow: "hidden" }}>
                          <div
                            style={{
                              width: `${pct}%`,
                              height: "100%",
                              background: "#6366f1",
                              transition: "width 0.3s",
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {success && <p style={{ color: "#10b981", marginTop: 12, fontSize: 13 }}>{success}</p>}
            {error && <p style={{ color: "red", marginTop: 12, fontSize: 13 }}>{error}</p>}
          </div>
        </div>
      )}
    </>
  );
};

export default CarteVote;
