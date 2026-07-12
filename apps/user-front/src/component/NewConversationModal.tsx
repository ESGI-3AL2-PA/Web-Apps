import { useState } from "react";
import { useAuth } from "@repo/hooks";
import { createConversation } from "../api-service/conversations.service";
import type { UserPublic } from "../api-service/users.service";
import UserAutocomplete from "./UserAutocomplete";

type NewConversationModalProps = {
  onClose: () => void;
  onCreated: (conversationId: string) => void;
};

const NewConversationModal = ({ onClose, onCreated }: NewConversationModalProps) => {
  const { user } = useAuth();
  const [target, setTarget] = useState<UserPublic | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    if (!target) {
      setError("Choisis un voisin");
      return;
    }
    if (target.id === user.id) {
      setError("Tu ne peux pas démarrer une conversation avec toi-même");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await createConversation({
        participants: [user.id, target.id],
        type: "direct",
      });
      onCreated(created.id);
      onClose();
    } catch {
      setError("Impossible de créer la conversation (utilisateur introuvable ?)");
    } finally {
      setBusy(false);
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
          padding: 24,
          maxWidth: 420,
          width: "90%",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Nouvelle conversation</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            style={{
              fontSize: 22,
              lineHeight: 1,
              minWidth: 44,
              minHeight: 44,
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <label
            htmlFor="new-conversation-participant"
            style={{ fontSize: 13, color: "#374151", display: "block", marginBottom: 6 }}
          >
            Voisin à contacter :
          </label>
          <UserAutocomplete id="new-conversation-participant" selected={target} onSelect={setTarget} autoFocus />
          {error && <p style={{ color: "red", fontSize: 13, marginTop: 8 }}>{error}</p>}
          <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: "#f3f4f6",
                color: "#111",
                border: "1px solid #d1d5db",
                borderRadius: 6,
                padding: "8px 14px",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={busy}
              style={{
                background: "#6366f1",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                padding: "8px 14px",
                cursor: "pointer",
                fontSize: 13,
                opacity: busy ? 0.5 : 1,
              }}
            >
              {busy ? "Création…" : "Créer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewConversationModal;
