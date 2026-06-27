import { useEffect, useState } from "react";
import { useAuth } from "@repo/hooks";
import type { ConversationResponseDto } from "@repo/contracts";
import { getUserPublic } from "../api-service/users.service";
import { useSocket } from "../sockets/SocketProvider";

type CarteConversationProps = {
  conversation: ConversationResponseDto;
  active: boolean;
  unreadCount?: number;
  onClick: () => void;
};

const formatTime = (iso?: string) => {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) {
      return new Intl.DateTimeFormat("fr-FR", { timeStyle: "short" }).format(d);
    }
    return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short" }).format(d);
  } catch {
    return "";
  }
};

const CarteConversation = ({ conversation, active, unreadCount = 0, onClick }: CarteConversationProps) => {
  const { user } = useAuth();
  const { isUserOnline } = useSocket();
  const [otherName, setOtherName] = useState<string>("…");
  const [otherId, setOtherId] = useState<string | null>(null);

  useEffect(() => {
    if (conversation.type === "group" && conversation.name) {
      setOtherName(conversation.name);
      setOtherId(null);
      return;
    }
    const oid = conversation.participants.find((p) => p !== user?.id);
    if (!oid) {
      setOtherName("Inconnu");
      return;
    }
    setOtherId(oid);
    getUserPublic(oid)
      .then((u) => setOtherName(`${u.firstName} ${u.lastName}`))
      .catch(() => setOtherName(oid.slice(0, 8)));
  }, [conversation, user?.id]);

  const online = otherId ? isUserOnline(otherId) : false;

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        background: active ? "#eef2ff" : "transparent",
        border: "none",
        borderLeft: active ? "3px solid #6366f1" : "3px solid transparent",
        padding: "12px 14px",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
          {otherId && (
            <span
              title={online ? "En ligne" : "Hors ligne"}
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: online ? "#10b981" : "#9ca3af",
                display: "inline-block",
              }}
            />
          )}
          {otherName}
        </span>
        <span style={{ fontSize: 11, color: "#666" }}>{formatTime(conversation.lastMessageAt)}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "#888" }}>
          {conversation.type === "group" ? `${conversation.participants.length} participants` : "Conversation directe"}
        </span>
        {unreadCount > 0 && (
          <span
            style={{
              background: "#6366f1",
              color: "#fff",
              borderRadius: 10,
              padding: "0 6px",
              fontSize: 11,
              fontWeight: 600,
              minWidth: 18,
              textAlign: "center",
            }}
          >
            {unreadCount}
          </span>
        )}
      </div>
    </button>
  );
};

export default CarteConversation;
