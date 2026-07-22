import type { MouseEventHandler } from "react";

// Icon-only row action for DataTable action columns. The label doubles as the tooltip and the
// accessible name, so text is never needed to convey meaning.
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
