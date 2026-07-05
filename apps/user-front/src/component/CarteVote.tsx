import { useMemo, useState } from "react";
import type { SubmitVoteResponseDto, VoteResponseDto } from "@repo/contracts";
import { getVoteById, submitVoteResponse } from "../api-service/votes.service";

// Carte cliquable + modale détail d'un vote.
// Gère 3 axes supplémentaires :
//   1. Détection "déjà voté" via vote.userHasVoted (le backend nous le dit)
//   2. multiple_choice → checkboxes (state Set<string>) au lieu de radio
//   3. Deadline expirée → désactive le form et affiche un badge
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
  const [localVote, setLocalVote] = useState<VoteResponseDto>(vote);
  // Mode édition : si l'user a déjà voté, on cache le form par défaut.
  // Click "Modifier mon vote" pour réafficher.
  const [editing, setEditing] = useState<boolean>(false);

  // ── État de sélection (radio pour single, Set pour multi) ────────────
  const isMulti = localVote.voteType === "multiple_choice";
  const [chosenSingle, setChosenSingle] = useState<string>("");
  const [chosenMulti, setChosenMulti] = useState<Set<string>>(new Set());

  const total = useMemo(
    () => localVote.results.reduce((sum, r) => sum + r.count, 0),
    [localVote.results],
  );

  // ── Calcul deadline expirée ──────────────────────────────────────────
  const isExpired = useMemo(() => {
    const end = new Date(localVote.endDate).getTime();
    return !Number.isNaN(end) && end < Date.now();
  }, [localVote.endDate]);

  const isClosed = localVote.status !== "open" || isExpired;

  // myChosenOptions vient du backend (peuplé via JWT).
  const myOptions = useMemo(() => new Set(localVote.myChosenOptions ?? []), [localVote.myChosenOptions]);
  const userHasVoted = localVote.userHasVoted === true;

  const closeModal = () => {
    setOpen(false);
    setError(null);
    setSuccess(null);
    setEditing(false);
    setChosenSingle("");
    setChosenMulti(new Set());
  };

  // Pré-rempli le formulaire avec la sélection actuelle quand on entre en édition.
  const startEditing = () => {
    setEditing(true);
    if (isMulti) {
      setChosenMulti(new Set(myOptions));
    } else {
      const first = localVote.myChosenOptions?.[0];
      if (first) setChosenSingle(first);
    }
  };

  const toggleMulti = (option: string) => {
    setChosenMulti((prev) => {
      const next = new Set(prev);
      if (next.has(option)) next.delete(option);
      else next.add(option);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let body: SubmitVoteResponseDto;
    if (isMulti) {
      if (chosenMulti.size === 0) {
        setError("Choisis au moins une option avant de voter");
        return;
      }
      body = { chosenOptions: Array.from(chosenMulti) };
    } else {
      if (!chosenSingle) {
        setError("Choisis une option avant de voter");
        return;
      }
      body = { chosenOption: chosenSingle };
    }

    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await submitVoteResponse(localVote.id, body);
      // Refetch pour avoir results + userHasVoted + myChosenOptions à jour
      const fresh = await getVoteById(localVote.id);
      setLocalVote(fresh);
      setSuccess("Vote enregistré ✓");
      setEditing(false);
      onChanged?.();
    } catch {
      setError("Échec du vote (option invalide, vote clos, ou autre)");
    } finally {
      setBusy(false);
    }
  };

  // ── Rendu carte (compact) ────────────────────────────────────────────
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
          {isExpired && localVote.status === "open" && (
            <span
              style={{
                background: "#fef3c7",
                color: "#92400e",
                borderRadius: 6,
                padding: "2px 7px",
                fontSize: 12,
              }}
            >
              Expiré
            </span>
          )}
          {isMulti && (
            <span style={{ background: "#e0e7ff", color: "#3730a3", borderRadius: 6, padding: "2px 7px", fontSize: 12 }}>
              Choix multiple
            </span>
          )}
          {userHasVoted && (
            <span style={{ background: "#d1fae5", color: "#065f46", borderRadius: 6, padding: "2px 7px", fontSize: 12 }}>
              ✓ Voté
            </span>
          )}
        </div>
      </button>

      {/* ── Modale détail ────────────────────────────────────────────── */}
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
              Statut : <strong>{localVote.status}</strong> ·{" "}
              {isExpired ? "Expiré (deadline dépassée)" : `Jusqu'au ${formatDate(localVote.endDate)}`} · {total} réponse
              {total > 1 ? "s" : ""} · Type : <strong>{isMulti ? "Choix multiple" : "Choix unique"}</strong>
            </p>

            {/* ── Cas 1 : user déjà voté, mode lecture ─────────────── */}
            {userHasVoted && !editing && (
              <div
                style={{
                  background: "#ecfdf5",
                  border: "1px solid #10b981",
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 16,
                }}
              >
                <p style={{ fontSize: 13, color: "#065f46", margin: 0 }}>
                  <strong>Vous avez voté pour :</strong>{" "}
                  {(localVote.myChosenOptions ?? []).map((opt, i) => (
                    <span key={opt}>
                      {i > 0 && ", "}
                      <span style={{ fontWeight: 600 }}>{opt}</span>
                    </span>
                  ))}
                </p>
                {!isClosed && (
                  <button
                    type="button"
                    onClick={startEditing}
                    style={{
                      marginTop: 8,
                      background: "#6366f1",
                      color: "#fff",
                      border: "none",
                      borderRadius: 6,
                      padding: "6px 12px",
                      cursor: "pointer",
                      fontSize: 12,
                    }}
                  >
                    Modifier mon vote
                  </button>
                )}
              </div>
            )}

            {/* ── Cas 2 : vote fermé/expiré et user n'a pas voté ─── */}
            {isClosed && !userHasVoted && (
              <div
                style={{
                  background: "#fef3c7",
                  border: "1px solid #f59e0b",
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 16,
                }}
              >
                <p style={{ fontSize: 13, color: "#92400e", margin: 0 }}>
                  {isExpired ? "Ce vote est expiré." : "Ce vote est clos."} Vous ne pouvez plus voter.
                </p>
              </div>
            )}

            {/* ── Cas 3 : formulaire de vote (création ou édition) ─ */}
            {!isClosed && (!userHasVoted || editing) && (
              <form onSubmit={handleSubmit} style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                  {localVote.options.map((opt) => {
                    const checked = isMulti ? chosenMulti.has(opt) : chosenSingle === opt;
                    return (
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
                          background: checked ? "#f0f9ff" : "transparent",
                        }}
                      >
                        <input
                          type={isMulti ? "checkbox" : "radio"}
                          name="chosen"
                          value={opt}
                          checked={checked}
                          onChange={() => (isMulti ? toggleMulti(opt) : setChosenSingle(opt))}
                        />
                        <span>{opt}</span>
                      </label>
                    );
                  })}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="submit"
                    disabled={busy}
                    style={{
                      background: "#6366f1",
                      color: "#fff",
                      border: "none",
                      borderRadius: 6,
                      padding: "8px 16px",
                      cursor: "pointer",
                      opacity: busy ? 0.5 : 1,
                    }}
                  >
                    {busy ? "Envoi…" : editing ? "Mettre à jour mon vote" : "Voter"}
                  </button>
                  {editing && (
                    <button
                      type="button"
                      onClick={() => setEditing(false)}
                      style={{
                        background: "#f3f4f6",
                        color: "#111",
                        border: "1px solid #d1d5db",
                        borderRadius: 6,
                        padding: "8px 16px",
                        cursor: "pointer",
                      }}
                    >
                      Annuler
                    </button>
                  )}
                </div>
              </form>
            )}

            {/* ── Résultats — barres horizontales, options votées surlignées ─ */}
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
                    const userChose = myOptions.has(opt);
                    return (
                      <div key={opt}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 2 }}>
                          <span style={{ fontWeight: userChose ? 600 : 400 }}>
                            {opt} {userChose && <span style={{ color: "#10b981" }}>✓</span>}
                          </span>
                          <span style={{ color: "#666" }}>
                            {count} ({pct}%)
                          </span>
                        </div>
                        <div style={{ background: "#f3f4f6", height: 8, borderRadius: 4, overflow: "hidden" }}>
                          <div
                            style={{
                              width: `${pct}%`,
                              height: "100%",
                              background: userChose ? "#10b981" : "#6366f1",
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
