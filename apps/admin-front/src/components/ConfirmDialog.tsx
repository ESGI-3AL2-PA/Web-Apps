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
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-base-100 rounded-box shadow-lg w-full max-w-sm p-6">
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-sm text-base-content/70">{message}</p>
        {error && <p className="text-sm text-error mt-3">{error}</p>}
        <div className="flex justify-end gap-2 mt-6">
          <button type="button" className="btn btn-soft" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn btn-error" onClick={onConfirm} disabled={busy}>
            {busy && <span className="loading loading-spinner loading-xs" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
