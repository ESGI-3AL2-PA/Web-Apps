import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@repo/hooks";
import type { ConversationResponseDto, MessageResponseDto } from "@repo/contracts";
import { getConversations, getMessages, sendMessage } from "../api-service/api";

const Messagerie = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationResponseDto[]>([]);
  const [error, setError] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageResponseDto[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getConversations()
      .then((res) => {
        const sorted = [...res.data].sort((a, b) =>
          (b.lastMessageAt ?? b.createdAt).localeCompare(a.lastMessageAt ?? a.createdAt),
        );
        setConversations(sorted);
      })
      .catch(() => setError(true));
  }, []);

  const loadMessages = useCallback(async (conversationId: string) => {
    try {
      const res = await getMessages(conversationId);
      setMessages([...res.data].sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
    } catch {
      /* keep previous */
    }
  }, []);

  // Load + poll messages for the open conversation.
  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    loadMessages(selectedId);
    const id = setInterval(() => loadMessages(selectedId), 5000);
    return () => clearInterval(id);
  }, [selectedId, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const content = input.trim();
    if (!content || !selectedId) return;
    setSending(true);
    try {
      const msg = await sendMessage(selectedId, content);
      setMessages((prev) => [...prev, msg]);
      setInput("");
    } catch {
      /* leave input for retry */
    } finally {
      setSending(false);
    }
  };

  const label = (c: ConversationResponseDto) => c.name || t("messaging.conversation");
  const time = (iso: string) => new Date(iso).toLocaleTimeString(i18n.language, { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex h-[calc(100vh-8rem)] overflow-hidden rounded-box border border-base-content/10">
      {/* Conversation list */}
      <aside
        className={`${selectedId ? "hidden md:flex" : "flex"} w-full flex-col overflow-y-auto border-r border-base-content/10 md:w-72`}
      >
        {error ? (
          <p className="p-4 text-sm text-base-content/70">{t("messaging.loadError")}</p>
        ) : conversations.length === 0 ? (
          <p className="p-4 text-sm text-base-content/60">{t("messaging.empty")}</p>
        ) : (
          conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className={`flex flex-col gap-0.5 border-b border-base-content/10 px-4 py-3 text-left hover:bg-base-200 ${
                selectedId === c.id ? "bg-base-200" : ""
              }`}
            >
              <span className="font-medium text-base-content">{label(c)}</span>
              {c.lastMessageAt && (
                <span className="text-xs text-base-content/50">
                  {new Date(c.lastMessageAt).toLocaleDateString(i18n.language)}
                </span>
              )}
            </button>
          ))
        )}
      </aside>

      {/* Thread */}
      <section className={`${selectedId ? "flex" : "hidden md:flex"} flex-1 flex-col`}>
        {!selectedId ? (
          <div className="flex flex-1 items-center justify-center p-4 text-center text-base-content/60">
            {t("messaging.select")}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 border-b border-base-content/10 px-4 py-2">
              <button className="btn btn-ghost btn-sm md:hidden" onClick={() => setSelectedId(null)}>
                ← {t("messaging.back")}
              </button>
              <span className="font-medium text-base-content">
                {label(conversations.find((c) => c.id === selectedId) ?? ({} as ConversationResponseDto))}
              </span>
            </div>

            <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-4">
              {messages.map((m) => {
                const mine = m.senderId === user?.id;
                return (
                  <div
                    key={m.id}
                    className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                      mine ? "self-end bg-primary text-primary-content" : "self-start bg-base-200 text-base-content"
                    }`}
                  >
                    <p>{m.content}</p>
                    <span
                      className={`mt-1 block text-[11px] ${mine ? "text-primary-content/70" : "text-base-content/50"}`}
                    >
                      {time(m.createdAt)}
                    </span>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            <form onSubmit={send} className="flex gap-2 border-t border-base-content/10 p-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t("messaging.placeholder")}
                aria-label={t("messaging.placeholder")}
                className="input input-bordered flex-1"
              />
              <button type="submit" className="btn btn-primary" disabled={sending || !input.trim()}>
                {t("messaging.send")}
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
};

export default Messagerie;
