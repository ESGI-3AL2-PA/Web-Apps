import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@repo/hooks";
import type { ConversationResponseDto, MessageResponseDto } from "@repo/contracts";
import { getConversations, getMessages, sendMessage } from "../api-service/conversations.service";
import { getUserPublic } from "../api-service/users.service";
import { useSocket } from "../sockets/SocketProvider";
import { formatRelative } from "../lib/format";

export default function Messages() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket } = useSocket();
  const [conversations, setConversations] = useState<ConversationResponseDto[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<MessageResponseDto[]>([]);
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load the conversation list + resolve the other participant's name.
  useEffect(() => {
    if (!user) return;
    getConversations({ participantId: user.id } as never)
      .then(async (convs) => {
        setConversations(convs);
        const entries = await Promise.all(
          convs.map(async (c) => {
            const otherId = c.participants.find((p) => p !== user.id);
            if (!otherId) return null;
            const u = await getUserPublic(otherId).catch(() => null);
            return u ? ([c.id, `${u.firstName} ${u.lastName}`] as const) : null;
          }),
        );
        setNames(Object.fromEntries(entries.filter(Boolean) as (readonly [string, string])[]));
      })
      .catch(() => setConversations([]));
  }, [user]);

  // Load messages of the selected conversation.
  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      return;
    }
    getMessages(conversationId, { limit: 100 } as never)
      .then(setMessages)
      .catch(() => setMessages([]));
  }, [conversationId]);

  // Live updates via socket.
  const onNewMessage = useCallback(
    (msg: MessageResponseDto) => {
      if (msg.conversationId === conversationId) {
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      }
    },
    [conversationId],
  );

  useEffect(() => {
    if (!socket) return;
    socket.on("message:new", onNewMessage);
    return () => {
      socket.off("message:new", onNewMessage);
    };
  }, [socket, onNewMessage]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const onSend = async (e: FormEvent) => {
    e.preventDefault();
    const content = draft.trim();
    if (!content || !conversationId) return;
    setDraft("");
    try {
      const sent = await sendMessage(conversationId, { type: "text", content });
      setMessages((prev) => (prev.some((m) => m.id === sent.id) ? prev : [...prev, sent]));
    } catch {
      setDraft(content);
    }
  };

  return (
    <div className="grid h-[70vh] grid-cols-1 gap-4 md:grid-cols-[280px_1fr]">
      {/* Conversation list */}
      <aside className="overflow-y-auto rounded-xl border border-neutral-200 bg-white">
        <h2 className="border-b border-neutral-100 p-4 text-lg font-bold text-neutral-900">Messages</h2>
        {conversations.length === 0 ? (
          <p className="p-4 text-sm text-neutral-500">Aucune conversation.</p>
        ) : (
          <ul>
            {conversations.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => navigate(`/messages/${c.id}`)}
                  className={`flex w-full items-center gap-3 border-b border-neutral-100 px-4 py-3 text-left hover:bg-neutral-50 ${
                    c.id === conversationId ? "bg-[color:var(--color-brand-soft)]" : ""
                  }`}
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--color-brand-soft)] text-sm font-bold text-[color:var(--color-brand-dark)]">
                    {(names[c.id] ?? "?").charAt(0)}
                  </div>
                  <span className="truncate text-sm font-medium text-neutral-800">{names[c.id] ?? "Conversation"}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      {/* Thread */}
      <section className="flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white">
        {!conversationId ? (
          <div className="flex flex-1 items-center justify-center text-neutral-400">Sélectionnez une conversation</div>
        ) : (
          <>
            <div className="flex-1 space-y-2 overflow-y-auto p-4">
              {messages.map((m) => {
                const mine = m.senderId === user?.id;
                return (
                  <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                        mine ? "bg-[color:var(--color-brand)] text-white" : "bg-neutral-100 text-neutral-800"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{m.content}</p>
                      <p className={`mt-0.5 text-[10px] ${mine ? "text-white/70" : "text-neutral-400"}`}>
                        {formatRelative(m.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
            <form onSubmit={onSend} className="flex gap-2 border-t border-neutral-100 p-3">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Votre message…"
                className="h-10 flex-1 rounded-lg border border-neutral-300 px-3 text-sm outline-none focus:border-[color:var(--color-brand)]"
              />
              <button
                type="submit"
                className="rounded-lg bg-[color:var(--color-brand)] px-4 text-sm font-semibold text-white hover:bg-[color:var(--color-brand-dark)]"
              >
                Envoyer
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
