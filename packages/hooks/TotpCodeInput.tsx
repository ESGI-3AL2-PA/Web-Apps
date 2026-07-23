import type { KeyboardEvent } from "react";

/** Longueur d'un code TOTP — les appelants s'en servent pour griser leur bouton de validation. */
export const TOTP_CODE_LENGTH = 6;

/**
 * Champ de saisie d'un code TOTP à 6 chiffres, partagé par les deux fronts (modales de
 * step-up, activation de la 2FA).
 *
 * Deux détails valent la centralisation :
 * - `autoComplete="one-time-code"` (+ un `name` explicite) : sans ça, ni les gestionnaires
 *   de mots de passe ni l'autofill iOS/Android ne reconnaissent le champ.
 * - le filtrage des chiffres est fait AVANT la troncature, sans `maxLength` : l'attribut
 *   tronque le texte collé avant tout traitement, donc un code collé sous la forme
 *   « 123 456 » (ou avec un saut de ligne) y perdait ses derniers chiffres.
 *
 * @param value     Valeur contrôlée (déjà normalisée : uniquement des chiffres).
 * @param onChange  Reçoit la valeur normalisée, tronquée à TOTP_CODE_LENGTH.
 * @param onSubmit  Optionnel — appelé sur Entrée, pour valider sans quitter le champ.
 */
export function TotpCodeInput({
  value,
  onChange,
  onSubmit,
  autoFocus = false,
  className = "input mt-1 w-40 tracking-[0.3em]",
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: () => void;
  autoFocus?: boolean;
  className?: string;
  id?: string;
}) {
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") onSubmit?.();
  };

  return (
    <input
      id={id}
      autoFocus={autoFocus}
      inputMode="numeric"
      name="one-time-code"
      autoComplete="one-time-code"
      className={className}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, TOTP_CODE_LENGTH))}
      onKeyDown={onSubmit ? onKeyDown : undefined}
      placeholder="000000"
    />
  );
}
