import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@repo/hooks";
import type { ConversationResponseDto, MessageResponseDto } from "@repo/contracts";
import {
  fetchAudioBlob,
  getConversations,
  getMessages,
  markMessageRead,
  sendMessage,
  sendVoiceMessage,
} from "../api-service/conversations.service";
import { getUserPublic } from "../api-service/users.service";
import { useSocket } from "../sockets/SocketProvider";
import { formatRelative } from "../lib/format";
import { useDialog } from "../components/DialogProvider";
import NewConversationModal from "../components/NewConversationModal";
import AudioRecorder from "../components/AudioRecorder";

// Renders a voice-note message: fetches the audio blob (Bearer-authed) and plays it.
function MessageAudio({ id }: { id: string }) {
  const { t } = useTranslation();
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let objectUrl: string | null = null;
    fetchAudioBlob(id)
      .then((b) => {
        objectUrl = URL.createObjectURL(b);
        setUrl(objectUrl);
      })
      .catch(() => undefined);
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);
  return url ? (
    <audio controls src={url} className="h-9 max-w-[220px]" />
  ) : (
    <span className="text-xs opacity-70">🎧 {t("common.loading")}</span>
  );
}

export default function Messages() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { socket, isUserOnline } = useSocket();
  const { alert } = useDialog();
  const [conversations, setConversations] = useState<ConversationResponseDto[]>([]);
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<MessageResponseDto[]>([]);
  const [draft, setDraft] = useState("");
  const [recording, setRecording] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const markedRef = useRef<Set<string>>(new Set());

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
  const otherIdOf = (c: ConversationResponseDto): string | undefined =>
    c.type === "group" ? undefined : c.participants.find((p) => p !== user?.id);
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

  // Read receipts: mark messages from others as read once, when they're in view.
  useEffect(() => {
    if (!user) return;
    for (const m of messages) {
      if (m.senderId !== user.id && !markedRef.current.has(m.id)) {
        markedRef.current.add(m.id);
        markMessageRead(m.id).catch(() => markedRef.current.delete(m.id));
      }
    }
  }, [messages, user]);

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

  const onSendVoice = async (blob: Blob) => {
    if (!conversationId) return;
    try {
      const sent = await sendVoiceMessage(conversationId, blob);
      setMessages((prev) => (prev.some((m) => m.id === sent.id) ? prev : [...prev, sent]));
      setRecording(false);
    } catch {
      await alert({ message: t("messages.voiceError") });
    }
  };

  return (
    <div className="grid h-[calc(100dvh-13rem)] grid-cols-1 gap-4 md:h-[70vh] md:grid-cols-[280px_1fr]">
      {/* Conversation list */}
      <aside
        className={`overflow-y-auto rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 ${
          conversationId ? "hidden md:block" : ""
        }`}
      >
        <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 p-4">
          <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-50">{t("messages.title")}</h2>
          <button
            onClick={() => setShowNew(true)}
            className="rounded-lg bg-[color:var(--color-brand)] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[color:var(--color-brand-dark)]"
          >
            {t("messages.new")}
          </button>
        </div>
        {conversations.length === 0 ? (
          <p className="p-4 text-sm text-neutral-500 dark:text-neutral-400">{t("messages.noConversations")}</p>
        ) : (
          <ul>
            {conversations.map((c) => {
              const otherId = otherIdOf(c);
              const online = otherId ? isUserOnline(otherId) : false;
              return (
                <li key={c.id}>
                  <button
                    onClick={() => navigate(`/messages/${c.id}`)}
                    className={`flex w-full items-center gap-3 border-b border-neutral-100 dark:border-neutral-800 px-4 py-3 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800 ${
                      c.id === conversationId ? "bg-[color:var(--color-brand-soft)]" : ""
                    }`}
                  >
                    <div className="relative">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--color-brand-soft)] text-sm font-bold text-[color:var(--color-brand-dark)]">
                        {c.type === "group" ? "👥" : titleOf(c).charAt(0).toUpperCase()}
                      </div>
                      {online && (
                        <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-green-500" />
                      )}
                    </div>
                    <span className="truncate text-sm font-medium text-neutral-800 dark:text-neutral-100">
                      {titleOf(c)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </aside>

      {/* Thread */}
      <section
        className={`flex-col overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 ${
          conversationId ? "flex" : "hidden md:flex"
        }`}
      >
        {!conversationId ? (
          <div className="flex flex-1 items-center justify-center text-neutral-400 dark:text-neutral-500">
            {t("messages.select")}
          </div>
        ) : (
          <>
            {active && (
              <header className="border-b border-neutral-100 dark:border-neutral-800 px-4 py-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => navigate("/messages")}
                    aria-label={t("messages.back")}
                    className="-ml-1 shrink-0 rounded-md p-1 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 md:hidden"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  {active.type === "group" && <span>👥</span>}
                  <h2 className="truncate font-bold text-neutral-900 dark:text-neutral-50">{titleOf(active)}</h2>
                  {(() => {
                    const otherId = otherIdOf(active);
                    return otherId && isUserOnline(otherId) ? (
                      <span className="ml-1 flex items-center gap-1 text-xs font-medium text-green-600">
                        <span className="h-2 w-2 rounded-full bg-green-500" />
                        {t("messages.online")}
                      </span>
                    ) : null;
                  })()}
                </div>
                {active.type === "group" && (
                  <p className="mt-0.5 truncate text-xs text-neutral-500 dark:text-neutral-400">
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
                        mine
                          ? "bg-[color:var(--color-brand)] text-white"
                          : "bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100"
                      }`}
                    >
                      {!mine && active?.type === "group" && (
                        <p className="mb-0.5 text-[11px] font-semibold text-[color:var(--color-brand-dark)]">
                          {nameOf(m.senderId)}
                        </p>
                      )}
                      {m.type === "audio" ? (
                        <MessageAudio id={m.id} />
                      ) : (
                        <p className="whitespace-pre-wrap">{m.content}</p>
                      )}
                      <p
                        className={`mt-0.5 text-[10px] ${mine ? "text-white/70" : "text-neutral-400 dark:text-neutral-500"}`}
                      >
                        {formatRelative(m.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
            {recording ? (
              <div className="border-t border-neutral-100 dark:border-neutral-800 p-3">
                <AudioRecorder onSubmit={onSendVoice} onCancel={() => setRecording(false)} />
              </div>
            ) : (
              <form onSubmit={onSend} className="flex gap-2 border-t border-neutral-100 dark:border-neutral-800 p-3">
                <button
                  type="button"
                  onClick={() => setRecording(true)}
                  aria-label={t("messages.recordStart")}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-neutral-300 dark:border-neutral-700 text-lg hover:bg-neutral-50 dark:hover:bg-neutral-800"
                >
                  🎙
                </button>
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={t("messages.placeholder")}
                  className="h-10 flex-1 rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 text-sm outline-none focus:border-[color:var(--color-brand)]"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-[color:var(--color-brand)] px-4 text-sm font-semibold text-white hover:bg-[color:var(--color-brand-dark)]"
                >
                  {t("messages.send")}
                </button>
              </form>
            )}
          </>
        )}
      </section>

      {showNew && (
        <NewConversationModal onClose={() => setShowNew(false)} onCreated={(id) => navigate(`/messages/${id}`)} />
      )}
    </div>
  );
}
