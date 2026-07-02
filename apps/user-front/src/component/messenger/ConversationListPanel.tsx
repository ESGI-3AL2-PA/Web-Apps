import { useTranslation } from "react-i18next";
import type { ConversationResponseDto } from "@repo/contracts";

interface ConversationListPanelProps {
  conversations: ConversationResponseDto[];
  error: boolean;
  onOpen: (id: string) => void;
  onClose: () => void;
}

const ConversationListPanel = ({ conversations, error, onOpen, onClose }: ConversationListPanelProps) => {
  const { t, i18n } = useTranslation();
  const label = (c: ConversationResponseDto) => c.name || t("messaging.conversation");

  return (
    <div className="flex h-[28rem] w-80 flex-col overflow-hidden rounded-box border border-base-content/10 bg-base-100 shadow-lg">
      <div className="flex items-center justify-between border-b border-base-content/10 bg-base-200 px-3 py-2">
        <span className="font-bold text-base-content">{t("messaging.title")}</span>
        <button type="button" className="btn btn-ghost btn-xs" onClick={onClose} aria-label={t("messaging.close")}>
          ✕
        </button>
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto">
        {error ? (
          <p className="p-4 text-sm text-base-content/70">{t("messaging.loadError")}</p>
        ) : conversations.length === 0 ? (
          <p className="p-4 text-sm text-base-content/60">{t("messaging.empty")}</p>
        ) : (
          conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => onOpen(c.id)}
              className="flex flex-col gap-0.5 border-b border-base-content/10 px-4 py-3 text-left hover:bg-base-200"
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
      </div>
    </div>
  );
};

export default ConversationListPanel;
