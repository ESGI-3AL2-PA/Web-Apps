import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

/**
 * Composant d'enregistrement d'une note vocale courte via MediaRecorder (audio/webm).
 * Capture, prévisualise (balise <audio>), puis remet le Blob au parent à l'envoi.
 *
 * @param onSubmit - appelé avec le Blob audio enregistré ; peut être asynchrone.
 * @param onCancel - ferme le panneau sans envoyer.
 */
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
  const chunksRef = useRef<Blob[]>([]); // fragments audio accumulés au fil de l'enregistrement
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStartedRef = useRef(false); // garde-fou contre le double-montage de StrictMode

  // Nettoyage au démontage : révoque l'object URL, coupe les pistes micro et arrête le timer.
  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      if (timerRef.current) clearInterval(timerRef.current);
    },
    [previewUrl],
  );

  // Démarre la capture micro et le chronomètre.
  const start = async () => {
    setError(null);
    // getUserMedia n'existe que dans un contexte sécurisé (https, ou http sur localhost). En
    // http simple sur une IP/hôte de réseau local, `mediaDevices` est undefined — on affiche
    // la vraie raison au lieu de retomber sur le message générique « vérifiez vos permissions ».
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(t("messages.micUnsupported"));
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const rec = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      // À l'arrêt : assemble les fragments en un Blob, en génère l'URL de prévisualisation
      // et libère les pistes du micro.
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

  // Stoppe l'enregistrement (déclenche onstop) et arrête le chronomètre.
  const stop = () => {
    recorderRef.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  // Démarre la capture immédiatement au montage : le parent n'affiche ce panneau qu'une fois
  // que l'utilisateur a déjà tapé sur le micro, un second appui « start » serait redondant.
  // Le ref protège du double-appel de React StrictMode en développement.
  useEffect(() => {
    if (autoStartedRef.current) return;
    autoStartedRef.current = true;
    void start();
  }, []);

  // Réinitialise l'enregistrement (« refaire ») : libère la prévisualisation et efface le Blob.
  const reset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setBlob(null);
    setPreviewUrl("");
    setElapsed(0);
  };

  // Remet le Blob au parent via onSubmit, en gérant l'état « envoi en cours ».
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
    <div className="flex flex-col gap-2 rounded-box border border-base-content/20 bg-base-100 p-3">
      <div className="flex items-center gap-2">
        {!recording && !blob && (
          <button
            type="button"
            onClick={start}
            aria-label={t("messages.recordStart")}
            className="flex size-10 items-center justify-center rounded-full bg-error text-lg text-error-content"
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
              className="flex size-10 items-center justify-center rounded-full bg-neutral text-neutral-content"
            >
              ⏹
            </button>
            <span className="text-xs text-error">
              ● {t("messages.recording")} {elapsed}s
            </span>
          </>
        )}
        {blob && previewUrl && <audio controls src={previewUrl} className="h-9" />}
        <div className="flex-1" />
        {blob && (
          <>
            <button type="button" onClick={reset} className="btn btn-soft btn-sm">
              {t("messages.redo")}
            </button>
            <button type="button" onClick={send} disabled={sending} className="btn btn-primary btn-sm">
              {sending ? t("messages.sending") : t("messages.send")}
            </button>
          </>
        )}
        <button type="button" onClick={onCancel} className="text-xs text-base-content/60 hover:text-base-content">
          {t("common.cancel")}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-error">
          {error}
        </p>
      )}
    </div>
  );
}
