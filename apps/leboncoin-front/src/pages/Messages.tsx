import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@repo/hooks";
import type { ConversationResponseDto, MessageResponseDto } from "@repo/contracts";
import { getConversations, getMessages, sendMessage } from "../api-service/conversations.service";
import { getUserPublic } from "../api-service/users.service";
import { useSocket } from "../sockets/SocketProvider";
import { formatRelative } from "../lib/format";

export default function Messages() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { socket } = useSocket();
  const [conversations, setConversations] = useState<ConversationResponseDto[]>([]);
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<MessageResponseDto[]>([]);
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load the conversation list + resolve every participant's name (needed for groups too).
  useEffect(() => {
    if (!user) return;
    getConversations({ participantId: user.id } as never)
      .then(async (convs) => {
        setConversations(convs);
        const ids = [...new Set(convs.flatMap((c) => c.participants))].filter((id) => id && id !== user.id);
        const entries = await Promise.all(
          ids.map(async (id) => {
            const u = await getUserPublic(id).catch(() => null);
            return u ? ([id, `${u.firstName} ${u.lastName}`] as const) : null;
          }),
        );
        setUserNames(Object.fromEntries(entries.filter(Boolean) as (readonly [string, string])[]));
      })
      .catch(() => setConversations([]));
  }, [user]);

  // A conversation's display title: its name for groups, otherwise the other participant.
  const titleOf = (c: ConversationResponseDto): string => {
    if (c.type === "group") return c.name?.trim() || t("messages.group");
    const otherId = c.participants.find((p) => p !== user?.id);
    return (otherId && userNames[otherId]) || t("messages.conversation");
  };
  const nameOf = (id: string): string => (id === user?.id ? t("messages.you") : (userNames[id] ?? "…"));
  const active = conversations.find((c) => c.id === conversationId);

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
        <h2 className="border-b border-neutral-100 p-4 text-lg font-bold text-neutral-900">{t("messages.title")}</h2>
        {conversations.length === 0 ? (
          <p className="p-4 text-sm text-neutral-500">{t("messages.noConversations")}</p>
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
                    {c.type === "group" ? "👥" : titleOf(c).charAt(0).toUpperCase()}
                  </div>
                  <span className="truncate text-sm font-medium text-neutral-800">{titleOf(c)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      {/* Thread */}
      <section className="flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white">
        {!conversationId ? (
          <div className="flex flex-1 items-center justify-center text-neutral-400">{t("messages.select")}</div>
        ) : (
          <>
            {active && (
              <header className="border-b border-neutral-100 px-4 py-3">
                <div className="flex items-center gap-2">
                  {active.type === "group" && <span>👥</span>}
                  <h2 className="truncate font-bold text-neutral-900">{titleOf(active)}</h2>
                </div>
                {active.type === "group" && (
                  <p className="mt-0.5 truncate text-xs text-neutral-500">
                    {t("messages.participantCount", { count: active.participants.length })} ·{" "}
                    {active.participants.map(nameOf).join(", ")}
                  </p>
                )}
              </header>
            )}
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
                      {!mine && active?.type === "group" && (
                        <p className="mb-0.5 text-[11px] font-semibold text-[color:var(--color-brand-dark)]">
                          {nameOf(m.senderId)}
                        </p>
                      )}
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
                placeholder={t("messages.placeholder")}
                className="h-10 flex-1 rounded-lg border border-neutral-300 px-3 text-sm outline-none focus:border-[color:var(--color-brand)]"
              />
              <button
                type="submit"
                className="rounded-lg bg-[color:var(--color-brand)] px-4 text-sm font-semibold text-white hover:bg-[color:var(--color-brand-dark)]"
              >
                {t("messages.send")}
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
