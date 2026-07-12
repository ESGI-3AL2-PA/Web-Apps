import { useEffect, useRef, useState } from "react";

type AudioRecorderProps = {
  onSubmit: (blob: Blob) => Promise<void> | void;
  onCancel: () => void;
};

const AudioRecorder = ({ onSubmit, onCancel }: AudioRecorderProps) => {
  const [recording, setRecording] = useState<boolean>(false);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState<boolean>(false);
  const [elapsedSec, setElapsedSec] = useState<number>(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [previewUrl]);

  const start = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const rec = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
        setBlob(audioBlob);
        setPreviewUrl(URL.createObjectURL(audioBlob));
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
      setElapsedSec(0);
      timerRef.current = setInterval(() => setElapsedSec((s) => s + 1), 1000);
    } catch {
      setError("Impossible d'accéder au micro. Vérifie les permissions du navigateur.");
    }
  };

  const stop = () => {
    recorderRef.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const reset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setBlob(null);
    setPreviewUrl("");
    setElapsedSec(0);
  };

  const handleSend = async () => {
    if (!blob) return;
    setSending(true);
    try {
      await onSubmit(blob);
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #d1d5db",
        borderRadius: 10,
        padding: 14,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {!recording && !blob && (
          <button
            type="button"
            onClick={start}
            style={{
              background: "#ef4444",
              color: "#fff",
              border: "none",
              borderRadius: "50%",
              width: 44,
              height: 44,
              cursor: "pointer",
              fontSize: 20,
            }}
            title="Démarrer l'enregistrement"
            aria-label="Démarrer l'enregistrement"
          >
            <span aria-hidden="true">🎙</span>
          </button>
        )}
        {recording && (
          <>
            <button
              type="button"
              onClick={stop}
              style={{
                background: "#374151",
                color: "#fff",
                border: "none",
                borderRadius: "50%",
                width: 44,
                height: 44,
                cursor: "pointer",
                fontSize: 16,
              }}
              title="Arrêter"
              aria-label="Arrêter l'enregistrement"
            >
              <span aria-hidden="true">⏹</span>
            </button>
            {/* Announce the start once; the ticking counter itself is not a live
                region, otherwise a polite status re-reads "…1s …2s" every second. */}
            <span role="status" className="sr-only">
              Enregistrement en cours
            </span>
            <span aria-hidden="true" style={{ fontSize: 13, color: "#7f1d1d" }}>
              ● Enregistrement… {elapsedSec}s
            </span>
          </>
        )}
        {blob && previewUrl && <audio controls src={previewUrl} style={{ height: 36 }} />}

        <div style={{ flex: 1 }} />

        {blob && (
          <>
            <button
              type="button"
              onClick={reset}
              style={{
                background: "transparent",
                color: "#374151",
                border: "1px solid #d1d5db",
                borderRadius: 6,
                padding: "6px 10px",
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              Refaire
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={sending}
              style={{
                background: "#10b981",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                padding: "6px 12px",
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              {sending ? "Envoi…" : "Envoyer"}
            </button>
          </>
        )}

        <button
          type="button"
          onClick={onCancel}
          style={{
            background: "transparent",
            color: "#6b7280",
            border: "none",
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          Annuler
        </button>
      </div>
      {error && (
        <p role="alert" style={{ color: "red", fontSize: 12, margin: 0 }}>
          {error}
        </p>
      )}
    </div>
  );
};

export default AudioRecorder;
