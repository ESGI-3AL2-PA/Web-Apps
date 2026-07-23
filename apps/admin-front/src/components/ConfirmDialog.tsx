import { useId } from "react";
import { useTranslation } from "react-i18next";
import { ModalFrame } from "./ModalFrame";

/** Props de ConfirmDialog. */
interface ConfirmDialogProps {
  open: boolean; // affiche la modale ; ne rend rien si false
  title: string;
  message: string;
  confirmLabel?: string; // libellé du bouton de confirmation (défaut : « supprimer »)
  busy?: boolean; // opération en cours : désactive les boutons et bloque la fermeture
  error?: string | null; // message d'erreur à afficher (relié via aria-describedby)
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Modale de confirmation générique (action destructive par défaut). L'appelant pilote l'état
 * `busy`/`error` — le composant est purement présentationnel et contrôlé.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  busy,
  error,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const errorId = useId();
  if (!open) return null;

  return (
    <ModalFrame
      onClose={onCancel}
      dismissible={!busy}
      align="center"
      labelledBy={titleId}
      panelClassName="max-w-sm p-6"
    >
      <h3 id={titleId} className="text-lg font-semibold mb-2">
        {title}
      </h3>
      <p className="text-sm text-base-content/70">{message}</p>
      {error && (
        <p id={errorId} role="alert" className="text-sm text-error mt-3">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2 mt-6">
        <button type="button" className="btn btn-soft" onClick={onCancel} disabled={busy}>
          {t("common.actions.cancel")}
        </button>
        <button
          type="button"
          className="btn btn-error"
          onClick={onConfirm}
          disabled={busy}
          aria-describedby={error ? errorId : undefined}
        >
          {busy && <span className="loading loading-spinner loading-xs" />}
          {confirmLabel ?? t("common.actions.delete")}
        </button>
      </div>
    </ModalFrame>
  );
}
