import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@repo/hooks";
import type { ConversationResponseDto, MessageResponseDto } from "@repo/contracts";
import { getMessages, sendMessage } from "../../api-service/api";

interface ChatWindowProps {
  conversation: ConversationResponseDto;
  onClose: () => void;
}

const ChatWindow = ({ conversation, onClose }: ChatWindowProps) => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [messages, setMessages] = useState<MessageResponseDto[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const label = conversation.name || t("messaging.conversation");

  const loadMessages = useCallback(async () => {
    try {
      const res = await getMessages(conversation.id);
      setMessages([...res.data].sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
    } catch {
      /* keep previous */
    }
  }, [conversation.id]);

  // Load + poll messages while the window is expanded.
  useEffect(() => {
    if (minimized) return;
    loadMessages();
    const id = setInterval(loadMessages, 5000);
    return () => clearInterval(id);
  }, [minimized, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const content = input.trim();
    if (!content) return;
    setSending(true);
    try {
      const msg = await sendMessage(conversation.id, content);
      setMessages((prev) => [...prev, msg]);
      setInput("");
    } catch {
      /* leave input for retry */
    } finally {
      setSending(false);
    }
  };

  const time = (iso: string) => new Date(iso).toLocaleTimeString(i18n.language, { hour: "2-digit", minute: "2-digit" });

  return (
    <div
      className={`flex w-72 flex-col overflow-hidden rounded-box border border-base-content/10 bg-base-100 shadow-lg md:w-80 ${
        minimized ? "" : "h-[28rem]"
      }`}
    >
      <div className="flex items-center gap-1 border-b border-base-content/10 bg-base-200 px-3 py-2">
        <button
          type="button"
          onClick={() => setMinimized((m) => !m)}
          className="flex-1 truncate text-left font-medium text-base-content"
          aria-label={t("messaging.minimize")}
        >
          {label}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-xs"
          onClick={() => setMinimized((m) => !m)}
          aria-label={t("messaging.minimize")}
        >
          {minimized ? "▲" : "▁"}
        </button>
        <button type="button" className="btn btn-ghost btn-xs" onClick={onClose} aria-label={t("messaging.close")}>
          ✕
        </button>
      </div>

      {!minimized && (
        <>
          <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
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

          <form onSubmit={send} className="flex gap-2 border-t border-base-content/10 p-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t("messaging.placeholder")}
              aria-label={t("messaging.placeholder")}
              className="input input-sm input-bordered flex-1"
            />
            <button type="submit" className="btn btn-sm btn-primary" disabled={sending || !input.trim()}>
              {t("messaging.send")}
            </button>
          </form>
        </>
      )}
    </div>
  );
};

export default ChatWindow;
