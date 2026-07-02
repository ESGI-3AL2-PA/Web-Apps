import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ConversationResponseDto } from "@repo/contracts";
import { getConversations } from "../../api-service/api";
import ChatWindow from "./ChatWindow";
import ConversationListPanel from "./ConversationListPanel";

// Max chat windows kept open at once (oldest is dropped past this).
const MAX_OPEN = 3;

const MessengerDock = () => {
  const { t } = useTranslation();
  const [listOpen, setListOpen] = useState(false);
  const [openChats, setOpenChats] = useState<string[]>([]);
  const [conversations, setConversations] = useState<ConversationResponseDto[]>([]);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await getConversations();
      const sorted = [...res.data].sort((a, b) =>
        (b.lastMessageAt ?? b.createdAt).localeCompare(a.lastMessageAt ?? a.createdAt),
      );
      setConversations(sorted);
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  // Load + poll the conversation list while the panel is open.
  useEffect(() => {
    if (!listOpen) return;
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, [listOpen, load]);

  const openChat = (id: string) => {
    setOpenChats((prev) => {
      const next = prev.filter((c) => c !== id);
      next.push(id);
      return next.slice(-MAX_OPEN);
    });
  };

  const closeChat = (id: string) => setOpenChats((prev) => prev.filter((c) => c !== id));

  const byId = (id: string) => conversations.find((c) => c.id === id);

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-row-reverse items-end gap-3">
      {listOpen ? (
        <ConversationListPanel
          conversations={conversations}
          error={error}
          onOpen={openChat}
          onClose={() => setListOpen(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setListOpen(true)}
          className="btn btn-circle btn-primary btn-lg shadow-lg"
          aria-label={t("messaging.open")}
        >
          <span aria-hidden="true" className="text-2xl">
            💬
          </span>
        </button>
      )}

      {openChats.map((id, idx) => {
        const conversation = byId(id);
        if (!conversation) return null;
        // On small screens only the most-recent window is shown to avoid overflow.
        const mobileVisible = idx === openChats.length - 1;
        return (
          <div key={id} className={mobileVisible ? "flex" : "hidden md:flex"}>
            <ChatWindow conversation={conversation} onClose={() => closeChat(id)} />
          </div>
        );
      })}
    </div>
  );
};

export default MessengerDock;
