import { useEffect, useState } from "react";
import { useAuth } from "@repo/hooks";
import type { ConversationResponseDto } from "@repo/contracts";
import { getUserPublic } from "../api-service/users.service";

type ConversationHeaderProps = {
  conversation: ConversationResponseDto;
};

type Party = { id: string; label: string };

// En-tête du fil actif : titre + liste nominative des participants (résolue via
// /users/:id/public, caché côté service). L'utilisateur courant est marqué « Vous ».
const ConversationHeader = ({ conversation }: ConversationHeaderProps) => {
  const { user } = useAuth();
  const [parties, setParties] = useState<Party[]>(conversation.participants.map((id) => ({ id, label: "…" })));

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      conversation.participants.map(async (id) => {
        if (id === user?.id) return { id, label: "Vous" };
        try {
          const u = await getUserPublic(id);
          return { id, label: `${u.firstName} ${u.lastName}` };
        } catch {
          return { id, label: "Utilisateur" };
        }
      }),
    ).then((resolved) => {
      if (!cancelled) setParties(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [conversation.participants, user?.id]);

  const title =
    conversation.type === "group" && conversation.name
      ? conversation.name
      : `${conversation.participants.length} participants`;

  return (
    <div style={{ padding: 14, borderBottom: "1px solid #e5e7eb", background: "#fff" }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>{title}</h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
        {parties.map((p) => (
          <span
            key={p.id}
            style={{
              fontSize: 12,
              color: p.label === "Vous" ? "#4338ca" : "#374151",
              background: p.label === "Vous" ? "#eef2ff" : "#f3f4f6",
              borderRadius: 999,
              padding: "2px 10px",
            }}
          >
            {p.label}
          </span>
        ))}
      </div>
    </div>
  );
};

export default ConversationHeader;
