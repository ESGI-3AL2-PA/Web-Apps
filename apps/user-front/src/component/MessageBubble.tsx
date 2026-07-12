import { useEffect, useState } from "react";
import type { MessageResponseDto } from "@repo/contracts";
import { getUserPublic } from "../api-service/users.service";
import { fetchAudioBlob } from "../api-service/conversations.service";

type MessageBubbleProps = {
  message: MessageResponseDto;
  isMine: boolean;
  showSender: boolean;
};

const formatTime = (iso: string) => {
  try {
    return new Intl.DateTimeFormat("fr-FR", { timeStyle: "short" }).format(new Date(iso));
  } catch {
    return "";
  }
};

const MessageBubble = ({ message, isMine, showSender }: MessageBubbleProps) => {
  const [senderName, setSenderName] = useState<string>("");
  const [audioUrl, setAudioUrl] = useState<string>("");

  useEffect(() => {
    if (isMine || !showSender) return;
    let cancelled = false;
    getUserPublic(message.senderId)
      .then((u) => !cancelled && setSenderName(`${u.firstName} ${u.lastName}`))
      .catch(() => !cancelled && setSenderName("Utilisateur"));
    return () => {
      cancelled = true;
    };
  }, [message.senderId, isMine, showSender]);

  // Fetch l'audio en blob (Bearer auto) puis le wrap en URL locale
  useEffect(() => {
    if (message.type !== "audio") return;
    let cancelled = false;
    let createdUrl: string | null = null;
    fetchAudioBlob(message.id)
      .then((blob) => {
        if (cancelled) return;
        createdUrl = URL.createObjectURL(blob);
        setAudioUrl(createdUrl);
      })
      .catch(() => {
        if (!cancelled) setAudioUrl("");
      });
    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [message.id, message.type]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isMine ? "flex-end" : "flex-start",
        marginBottom: 8,
      }}
    >
      {!isMine && showSender && senderName && (
        <span style={{ fontSize: 11, color: "#666", marginLeft: 8, marginBottom: 2 }}>{senderName}</span>
      )}
      <div
        style={{
          maxWidth: "70%",
          padding: message.type === "audio" ? 6 : "8px 12px",
          borderRadius: 14,
          background: isMine ? "#6366f1" : "#f3f4f6",
          color: isMine ? "#fff" : "#111",
          borderBottomRightRadius: isMine ? 4 : 14,
          borderBottomLeftRadius: isMine ? 14 : 4,
          wordBreak: "break-word",
          whiteSpace: "pre-wrap",
        }}
      >
        {message.type === "audio" ? (
          audioUrl ? (
            <audio controls src={audioUrl} style={{ display: "block", maxWidth: 240, height: 36 }} />
          ) : (
            <span style={{ fontSize: 12, opacity: 0.8 }}>🎙 Chargement de l&apos;audio…</span>
          )
        ) : (
          <span style={{ fontSize: 14 }}>{message.content}</span>
        )}
      </div>
      <span style={{ fontSize: 10, color: "#666", marginTop: 2, marginLeft: 8, marginRight: 8 }}>
        {formatTime(message.createdAt)}
      </span>
    </div>
  );
};

export default MessageBubble;
