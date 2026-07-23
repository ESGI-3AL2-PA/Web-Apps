// Composant : coquille de dialogue (backdrop + panneau avec piège de focus).
// Brique de base réutilisée par FormModal et ConfirmDialog.
import type { ReactNode } from "react";
import { useModalBehavior } from "../hooks/useModalBehavior";

interface ModalFrameProps {
  onClose: () => void;
  /** À false, Échap et le clic sur le backdrop ne ferment pas (ex. pendant une action en cours). */
  dismissible?: boolean;
  align?: "start" | "center"; // alignement vertical du panneau dans l'overlay
  labelledBy?: string; // id du titre, pour aria-labelledby du role="dialog"
  panelClassName?: string;
  children: ReactNode;
}

/**
 * Coquille de dialogue : backdrop sombre + panneau avec piège de focus (useModalBehavior).
 * Le clic sur le backdrop ferme si autorisé — on ne réagit qu'au mousedown démarré sur
 * le backdrop lui-même (e.target === e.currentTarget), pas propagé depuis le panneau.
 */
export function ModalFrame({
  onClose,
  dismissible = true,
  align = "center",
  labelledBy,
  panelClassName,
  children,
}: ModalFrameProps) {
  const panelRef = useModalBehavior(onClose, dismissible);

  return (
    <div
      className={`fixed inset-0 z-50 flex justify-center overflow-y-auto bg-black/40 p-4 ${
        align === "start" ? "items-start" : "items-center"
      }`}
      onMouseDown={(e) => {
        // Ferme seulement si le mousedown a commencé sur le backdrop, pas sur le panneau.
        if (dismissible && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={`bg-base-100 rounded-box shadow-lg w-full outline-none ${panelClassName ?? ""}`}
      >
        {children}
      </div>
    </div>
  );
}
