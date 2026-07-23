// Hook : comportement de dialogue partagé par toutes les modales (accessibilité + UX).
import { useEffect, useRef } from "react";

// Sélecteur CSS des éléments focusables, en excluant ceux désactivés ou hors de l'ordre de tabulation.
const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Comportement de dialogue partagé par toutes les modales : Échap pour fermer, piège de focus (Tab
 * cycle dans le panneau), focus à l'ouverture avec restauration de l'élément précédemment focalisé,
 * et verrouillage du scroll du body.
 *
 * Attacher le ref retourné à l'élément panneau. N'a de sens que tant que la modale est montée : les
 * appelants doivent donc la monter conditionnellement (le démontage vaut fermeture).
 *
 * @param onClose  appelée pour demander la fermeture (via Échap si `dismissible`)
 * @param dismissible  autorise ou non la fermeture par Échap
 */
export function useModalBehavior(onClose: () => void, dismissible = true) {
  const panelRef = useRef<HTMLDivElement>(null);
  // Refs miroir : gardent la dernière valeur des props sans re-souscrire l'effet (deps vides).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const dismissibleRef = useRef(dismissible);
  dismissibleRef.current = dismissible;

  useEffect(() => {
    // Mémorise l'élément focalisé avant ouverture pour lui rendre le focus à la fermeture.
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const { body } = document;
    const prevOverflow = body.style.overflow;
    body.style.overflow = "hidden";

    // Éléments focusables actuellement visibles (offsetParent non null = affiché).
    const focusables = () =>
      Array.from(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter(
        (el) => el.offsetParent !== null,
      );

    // Focalise le premier contrôle, ou à défaut le panneau lui-même.
    (focusables()[0] ?? panelRef.current)?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      // Échap ferme si la modale est dismissible.
      if (e.key === "Escape" && dismissibleRef.current) {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      // Piège de focus : Tab sur le dernier revient au premier, Maj+Tab sur le premier va au dernier.
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    // Écoute en phase de capture (true) pour intercepter avant les handlers du contenu.
    document.addEventListener("keydown", onKeyDown, true);
    // Nettoyage : retire l'écouteur, restaure le scroll du body et rend le focus initial.
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, []);

  return panelRef;
}
