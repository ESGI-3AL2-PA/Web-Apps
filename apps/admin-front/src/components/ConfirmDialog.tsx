import { useId } from "react";
import { ModalFrame } from "./ModalFrame";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Delete",
  busy,
  error,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
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
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-error"
          onClick={onConfirm}
          disabled={busy}
          aria-describedby={error ? errorId : undefined}
        >
          {busy && <span className="loading loading-spinner loading-xs" />}
          {confirmLabel}
        </button>
      </div>
    </ModalFrame>
  );
}
