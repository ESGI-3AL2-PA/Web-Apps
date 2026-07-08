import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@repo/hooks";
import type { ConversationResponseDto, MessageResponseDto } from "@repo/contracts";
import {
  getConversations,
  getMessages,
  markMessageRead,
  sendMessage,
  sendVoiceMessage,
} from "../api-service/conversations.service";
import CarteConversation from "../component/CarteConversation";
import MessageBubble from "../component/MessageBubble";
import MessageComposer from "../component/MessageComposer";
import NewConversationModal from "../component/NewConversationModal";
import { useSocket } from "../sockets/SocketProvider";

// Polling fallback si le socket est down. Sinon le push remplace.
const POLL_INTERVAL_MS = 15_000;

const Messagerie = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [conversations, setConversations] = useState<ConversationResponseDto[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageResponseDto[]>([]);
  const [loadingConvs, setLoadingConvs] = useState<boolean>(true);
  const [loadingMsgs, setLoadingMsgs] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await getConversations({ limit: 100 } as never);
      // Tri par dernier message DESC
      const sorted = [...res.data].sort((a, b) => {
        const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return tb - ta;
      });
      setConversations(sorted);
      setError(null);
    } catch {
      setError("Impossible de charger les conversations");
    } finally {
      setLoadingConvs(false);
    }
  }, []);

  const fetchMessages = useCallback(async (conversationId: string) => {
    try {
      const res = await getMessages(conversationId, { limit: 100 } as never);
      // Tri ASC (les + anciens en haut, les + récents en bas)
      const sorted = [...res.data].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      setMessages(sorted);
    } catch {
      setError("Impossible de charger les messages");
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Quand on change de conversation active
  useEffect(() => {
    if (!activeId) return;
    setLoadingMsgs(true);
    fetchMessages(activeId).finally(() => setLoadingMsgs(false));
  }, [activeId, fetchMessages]);

  // Polling de secours (15s) + push socket pour le temps réel.
  useEffect(() => {
    const interval = setInterval(() => {
      fetchConversations();
      if (activeId) void fetchMessages(activeId);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [activeId, fetchConversations, fetchMessages]);

  // Push temps réel : à chaque nouveau message reçu, refetch ce qu'il faut.
  useEffect(() => {
    if (!socket) return;
    const onNewMessage = (msg: { conversationId: string }) => {
      fetchConversations();
      if (activeId && msg.conversationId === activeId) {
        void fetchMessages(activeId);
      }
    };
    socket.on("message:new", onNewMessage);
    return () => {
      socket.off("message:new", onNewMessage);
    };
  }, [socket, activeId, fetchConversations, fetchMessages]);

  // Auto-scroll bottom à chaque nouveau message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Marquer comme lu les messages reçus de la conversation active
  useEffect(() => {
    if (!activeId || !user?.id) return;
    const unreadFromOthers = messages.filter((m) => !m.read && m.senderId !== user.id);
    Promise.all(unreadFromOthers.map((m) => markMessageRead(m.id).catch(() => null)));
  }, [messages, activeId, user?.id]);

  const handleSend = async (content: string) => {
    if (!activeId) return;
    try {
      await sendMessage(activeId, { type: "text", content });
      await fetchMessages(activeId);
      await fetchConversations();
    } catch {
      setError("Échec de l'envoi du message");
    }
  };

  const handleSendVoice = async (blob: Blob) => {
    if (!activeId) return;
    try {
      await sendVoiceMessage(activeId, blob);
      await fetchMessages(activeId);
      await fetchConversations();
    } catch {
      setError("Échec de l'envoi du message vocal");
    }
  };

  const activeConv = conversations.find((c) => c.id === activeId) ?? null;

  if (!user?.id) {
    return <div style={{ padding: 24 }}>Connexion requise.</div>;
  }

  return (
    <div
      style={{
        display: "flex",
        height: "calc(100vh - 80px)",
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 10,
        overflow: "hidden",
        margin: 16,
      }}
    >
      {/* Sidebar conversations */}
      <div
        style={{
          width: 320,
          borderRight: "1px solid #e5e7eb",
          display: "flex",
          flexDirection: "column",
          background: "#fafafa",
        }}
      >
        <div
          style={{
            padding: 14,
            borderBottom: "1px solid #e5e7eb",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Conversations</h2>
          <button
            type="button"
            onClick={() => setShowNew(true)}
            style={{
              background: "#6366f1",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              padding: "5px 10px",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            + Nouveau
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {loadingConvs ? (
            <p style={{ padding: 14, color: "#666", fontSize: 13 }}>Chargement…</p>
          ) : conversations.length === 0 ? (
            <p style={{ padding: 14, color: "#666", fontSize: 13 }}>
              Aucune conversation. Cliquez sur "+ Nouveau" pour démarrer.
            </p>
          ) : (
            conversations.map((c) => (
              <CarteConversation
                key={c.id}
                conversation={c}
                active={c.id === activeId}
                onClick={() => setActiveId(c.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* Thread actif */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {!activeConv ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#666",
              fontSize: 14,
            }}
          >
            Sélectionne une conversation pour commencer.
          </div>
        ) : (
          <>
            <div
              style={{
                padding: 14,
                borderBottom: "1px solid #e5e7eb",
                background: "#fff",
              }}
            >
              <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>
                {activeConv.type === "group" && activeConv.name
                  ? activeConv.name
                  : `${activeConv.participants.length} participants`}
              </h2>
            </div>
            <div
              role="log"
              aria-live="polite"
              aria-label="Messages de la conversation"
              style={{
                flex: 1,
                overflowY: "auto",
                padding: 14,
                background: "#fafafa",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {loadingMsgs ? (
                <p style={{ color: "#666", fontSize: 13 }}>Chargement des messages…</p>
              ) : messages.length === 0 ? (
                <p style={{ color: "#666", fontSize: 13 }}>Aucun message. Lance la discussion !</p>
              ) : (
                messages.map((m) => (
                  <MessageBubble
                    key={m.id}
                    message={m}
                    isMine={m.senderId === user.id}
                    showSender={activeConv.type === "group"}
                  />
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
            <MessageComposer onSend={handleSend} onSendVoice={handleSendVoice} />
          </>
        )}
      </div>

      {showNew && (
        <NewConversationModal
          onClose={() => setShowNew(false)}
          onCreated={(id) => {
            setActiveId(id);
            fetchConversations();
          }}
        />
      )}

      {error && (
        <div
          role="alert"
          style={{
            position: "absolute",
            bottom: 20,
            right: 20,
            background: "#fee2e2",
            color: "#7f1d1d",
            padding: "8px 12px",
            borderRadius: 6,
            fontSize: 12,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
};

export default Messagerie;
