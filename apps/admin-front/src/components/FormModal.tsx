import { useId, type FormEvent, type ReactNode } from "react";
import { ModalFrame } from "./ModalFrame";

interface FormModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  /** When provided, the modal renders a <form> and footer submit button. */
  onSubmit?: (e: FormEvent) => void;
  submitLabel?: string;
  submitting?: boolean;
  error?: string | null;
  children: ReactNode;
  /** Hide the default footer (e.g. read-only detail views). */
  readOnly?: boolean;
  size?: "md" | "lg";
}

// Controlled modal — rendered as a focus-trapped overlay (see ModalFrame) rather than relying on
// flyonui's JS toggle, so open/close is pure React state.
export function FormModal({
  open,
  title,
  onClose,
  onSubmit,
  submitLabel = "Save",
  submitting,
  error,
  children,
  readOnly,
  size = "md",
}: FormModalProps) {
  const titleId = useId();
  if (!open) return null;

  const body = (
    <>
      <div className="flex items-center justify-between mb-4">
        <h3 id={titleId} className="text-lg font-semibold">
          {title}
        </h3>
        <button type="button" className="btn btn-text btn-circle btn-sm" onClick={onClose} aria-label="Close">
          <span className="icon-[tabler--x] size-5" />
        </button>
      </div>
      <div className="space-y-4">{children}</div>
      {error && <p className="text-sm text-error mt-3">{error}</p>}
      <div className="flex justify-end gap-2 mt-6">
        <button type="button" className="btn btn-soft" onClick={onClose}>
          {readOnly ? "Close" : "Cancel"}
        </button>
        {!readOnly && onSubmit && (
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting && <span className="loading loading-spinner loading-xs" />}
            {submitLabel}
          </button>
        )}
      </div>
    </>
  );

  return (
    <ModalFrame
      onClose={onClose}
      dismissible={!submitting}
      align="start"
      labelledBy={titleId}
      panelClassName={`my-8 p-6 ${size === "lg" ? "max-w-3xl" : "max-w-lg"}`}
    >
      {onSubmit && !readOnly ? <form onSubmit={onSubmit}>{body}</form> : body}
    </ModalFrame>
  );
}
