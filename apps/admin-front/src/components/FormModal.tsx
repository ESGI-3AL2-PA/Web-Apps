// Composant : modale de formulaire générique (création / édition / détail).
// S'appuie sur ModalFrame pour l'habillage (backdrop + piège de focus).
import { useId, type FormEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ModalFrame } from "./ModalFrame";

interface FormModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  /** Si fourni, la modale rend un <form> et un bouton de soumission dans le pied. */
  onSubmit?: (e: FormEvent) => void;
  submitLabel?: string;
  submitting?: boolean; // affiche un spinner et désactive le bouton pendant l'envoi
  error?: string | null; // message d'erreur affiché en bas du corps (role="alert")
  children: ReactNode;
  /** Masque le pied par défaut (ex. vues de détail en lecture seule). */
  readOnly?: boolean;
  size?: "md" | "lg";
}

/**
 * Modale contrôlée : rendue comme un overlay avec piège de focus (voir ModalFrame)
 * plutôt que via le toggle JS de flyonui — l'ouverture/fermeture reste du pur état React.
 * En readOnly (sans onSubmit), le pied n'affiche qu'un bouton "Fermer".
 */
export function FormModal({
  open,
  title,
  onClose,
  onSubmit,
  submitLabel,
  submitting,
  error,
  children,
  readOnly,
  size = "md",
}: FormModalProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const errorId = useId();
  // Rendu court-circuité tant que la modale est fermée (pas d'overlay dans le DOM).
  if (!open) return null;

  const body = (
    <>
      <div className="flex items-center justify-between mb-4">
        <h3 id={titleId} className="text-lg font-semibold">
          {title}
        </h3>
        <button
          type="button"
          className="btn btn-text btn-circle btn-sm"
          onClick={onClose}
          aria-label={t("common.actions.close")}
        >
          <span className="icon-[tabler--x] size-5" />
        </button>
      </div>
      <div className="space-y-4">{children}</div>
      {error && (
        <p id={errorId} role="alert" className="text-sm text-error mt-3">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2 mt-6">
        <button type="button" className="btn btn-soft" onClick={onClose}>
          {readOnly ? t("common.actions.close") : t("common.actions.cancel")}
        </button>
        {!readOnly && onSubmit && (
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting && <span className="loading loading-spinner loading-xs" />}
            {submitLabel ?? t("common.actions.save")}
          </button>
        )}
      </div>
    </>
  );

  return (
    // Non-dismissible pendant l'envoi : ni Échap ni clic backdrop ne ferment la modale.
    <ModalFrame
      onClose={onClose}
      dismissible={!submitting}
      align="start"
      labelledBy={titleId}
      panelClassName={`my-8 p-6 ${size === "lg" ? "max-w-3xl" : "max-w-lg"}`}
    >
      {onSubmit && !readOnly ? (
        <form
          onSubmit={onSubmit}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
        >
          {body}
        </form>
      ) : (
        body
      )}
    </ModalFrame>
  );
}
