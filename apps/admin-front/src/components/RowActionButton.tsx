// Composant : bouton d'action de ligne (icône seule) pour les colonnes d'action du DataTable.
import type { MouseEventHandler } from "react";

/**
 * Action de ligne icône-seule. Le `label` sert à la fois d'infobulle (title) et de
 * nom accessible (aria-label) : aucun texte visible n'est requis pour porter le sens.
 * `variant` permet d'ajouter une classe de couleur flyonui (ex. btn-error).
 */
export function RowActionButton({
  icon,
  label,
  onClick,
  variant,
}: {
  icon: string;
  label: string;
  onClick: MouseEventHandler<HTMLButtonElement>;
  variant?: string;
}) {
  return (
    <button
      type="button"
      className={`btn btn-xs btn-square btn-text ${variant ?? ""}`}
      onClick={onClick}
      title={label}
      aria-label={label}
    >
      <span className={`${icon} size-4`} />
    </button>
  );
}
