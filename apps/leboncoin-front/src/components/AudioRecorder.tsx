import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

// Records a short voice note via MediaRecorder (audio/webm), previews it, and
// hands the Blob to the parent on send.
export default function AudioRecorder({
  onSubmit,
  onCancel,
}: {
  onSubmit: (blob: Blob) => Promise<void> | void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [recording, setRecording] = useState(false);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      if (timerRef.current) clearInterval(timerRef.current);
    },
    [previewUrl],
  );

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
        const b = new Blob(chunksRef.current, { type: "audio/webm" });
        setBlob(b);
        setPreviewUrl(URL.createObjectURL(b));
        stream.getTracks().forEach((tr) => tr.stop());
        streamRef.current = null;
      };
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } catch {
      setError(t("messages.micError"));
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
    setElapsed(0);
  };

  const send = async () => {
    if (!blob) return;
    setSending(true);
    try {
      await onSubmit(blob);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-neutral-300 bg-white p-3">
      <div className="flex items-center gap-2">
        {!recording && !blob && (
          <button
            type="button"
            onClick={start}
            aria-label={t("messages.recordStart")}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500 text-lg text-white"
          >
            🎙
          </button>
        )}
        {recording && (
          <>
            <button
              type="button"
              onClick={stop}
              aria-label={t("messages.recordStop")}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-700 text-white"
            >
              ⏹
            </button>
            <span className="text-xs text-red-800">
              ● {t("messages.recording")} {elapsed}s
            </span>
          </>
        )}
        {blob && previewUrl && <audio controls src={previewUrl} className="h-9" />}
        <div className="flex-1" />
        {blob && (
          <>
            <button
              type="button"
              onClick={reset}
              className="rounded-md border border-neutral-300 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
            >
              {t("messages.redo")}
            </button>
            <button
              type="button"
              onClick={send}
              disabled={sending}
              className="rounded-md bg-[color:var(--color-brand)] px-3 py-1 text-xs font-semibold text-white hover:bg-[color:var(--color-brand-dark)] disabled:opacity-60"
            >
              {sending ? t("messages.sending") : t("messages.send")}
            </button>
          </>
        )}
        <button type="button" onClick={onCancel} className="text-xs text-neutral-500 hover:text-neutral-700">
          {t("common.cancel")}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
