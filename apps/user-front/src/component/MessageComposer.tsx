import { useState } from "react";
import AudioRecorder from "./AudioRecorder";

type MessageComposerProps = {
  onSend: (content: string) => Promise<void> | void;
  onSendVoice?: (blob: Blob) => Promise<void>;
  disabled?: boolean;
};

const MessageComposer = ({ onSend, onSendVoice, disabled = false }: MessageComposerProps) => {
  const [text, setText] = useState<string>("");
  const [sending, setSending] = useState<boolean>(false);
  const [recording, setRecording] = useState<boolean>(false);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      await onSend(trimmed);
      setText("");
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handleVoiceSubmit = async (blob: Blob) => {
    if (!onSendVoice) return;
    await onSendVoice(blob);
    setRecording(false);
  };

  return (
    <div style={{ borderTop: "1px solid #e5e7eb", background: "#fff" }}>
      {recording && onSendVoice && (
        <div style={{ padding: 10 }}>
          <AudioRecorder onSubmit={handleVoiceSubmit} onCancel={() => setRecording(false)} />
        </div>
      )}
      <div style={{ padding: 10, display: "flex", alignItems: "flex-end", gap: 8 }}>
        {onSendVoice && !recording && (
          <button
            type="button"
            onClick={() => setRecording(true)}
            disabled={disabled}
            style={{
              background: "#f3f4f6",
              color: "#374151",
              border: "1px solid #d1d5db",
              borderRadius: 8,
              width: 36,
              height: 36,
              cursor: "pointer",
              fontSize: 16,
            }}
            title="Enregistrer un message vocal"
          >
            🎙
          </button>
        )}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || recording}
          placeholder="Tape ton message… (Entrée pour envoyer, Maj+Entrée pour aller à la ligne)"
          rows={1}
          style={{
            flex: 1,
            resize: "none",
            padding: "8px 10px",
            border: "1px solid #d1d5db",
            borderRadius: 8,
            fontSize: 14,
            fontFamily: "inherit",
            maxHeight: 120,
            overflowY: "auto",
          }}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={disabled || sending || !text.trim() || recording}
          style={{
            background: text.trim() && !disabled && !recording ? "#6366f1" : "#9ca3af",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "9px 16px",
            cursor: text.trim() && !disabled && !recording ? "pointer" : "not-allowed",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {sending ? "…" : "Envoyer"}
        </button>
      </div>
    </div>
  );
};

export default MessageComposer;
