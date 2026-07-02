import type { ReactNode } from "react";
import { useModalBehavior } from "../hooks/useModalBehavior";

interface ModalFrameProps {
  onClose: () => void;
  /** When false, Escape / backdrop click won't dismiss (e.g. while an action is in flight). */
  dismissible?: boolean;
  align?: "start" | "center";
  labelledBy?: string;
  panelClassName?: string;
  children: ReactNode;
}

// The dialog shell: backdrop + focus-trapped panel. Backdrop click (mousedown started on the
// backdrop, not the panel) dismisses when allowed. Shared by FormModal and ConfirmDialog.
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
