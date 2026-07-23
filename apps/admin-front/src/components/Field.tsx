// Composant : wrapper libellé + contrôle pour les formulaires de modale.
import { cloneElement, isValidElement, useId } from "react";
import type { ReactElement, ReactNode } from "react";

interface FieldProps {
  label: string;
  children: ReactNode;
  hint?: string; // texte d'aide affiché sous le contrôle
  required?: boolean; // ajoute l'astérisque rouge sur le libellé
}

/**
 * Enveloppe un contrôle de formulaire avec son libellé. Génère un id, relie le
 * <label> au contrôle via htmlFor, et injecte cet id sur l'enfant — sauf si
 * l'appelant a déjà défini son propre id (préservé le cas échéant).
 */
export function Field({ label, children, hint, required }: FieldProps) {
  const id = useId();
  // Clone l'enfant pour lui imposer l'id du label ; à défaut d'élément valide, rendu tel quel.
  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<{ id?: string }>, {
        id: (children.props as { id?: string }).id ?? id,
      })
    : children;

  return (
    <div className="w-full">
      <label htmlFor={id} className="label-text mb-1 block">
        {label}
        {required && <span className="text-error"> *</span>}
      </label>
      {control}
      {hint && <p className="text-xs text-base-content/60 mt-1">{hint}</p>}
    </div>
  );
}
