/**
 * Hook (lib) : piège à focus pour une modale.
 *
 * Sans dépendance et compatible CSP. Utilisé par les panneaux de dialogue pour
 * confiner la navigation clavier tant qu'ils sont ouverts.
 */
import { useEffect, useRef } from "react";

// Sélecteur des éléments réellement focusables à l'intérieur du panneau.
const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * Gère le focus d'un unique panneau de dialogue. Tant que `active` est vrai :
 *  - déplace le focus dans le panneau et fait boucler Tab / Maj+Tab à l'intérieur,
 *  - restaure le focus sur l'élément précédemment actif à la fermeture/démontage,
 *  - appelle `onClose` sur Échap (ne rien passer si l'appelant gère Échap lui-même).
 *
 * @param active  Active le piège quand vrai.
 * @param onClose Callback optionnel déclenché sur Échap.
 * @returns Un ref à attacher à l'élément panneau.
 */
export function useFocusTrap<T extends HTMLElement = HTMLElement>(active: boolean, onClose?: () => void) {
  const ref = useRef<T>(null);
  // Ref sur onClose pour lire toujours la dernière version sans relancer l'effet.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!active) return;
    const panel = ref.current;
    if (!panel) return;
    // Mémorise l'élément focalisé avant l'ouverture pour le restaurer à la fermeture.
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Éléments focusables actuellement visibles (offsetParent non nul = affiché).
    const focusable = () =>
      Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);

    if (!panel.contains(document.activeElement)) {
      (focusable()[0] ?? panel).focus();
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCloseRef.current?.();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusable();
      // Aucun élément focusable : on garde le focus sur le panneau lui-même.
      if (items.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const current = document.activeElement;
      // Boucle le focus aux extrémités : Maj+Tab depuis le premier renvoie au dernier,
      // Tab depuis le dernier revient au premier.
      if (e.shiftKey) {
        if (current === first || !panel.contains(current)) {
          e.preventDefault();
          last.focus();
        }
      } else if (current === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previouslyFocused?.focus?.();
    };
  }, [active]);

  return ref;
}
