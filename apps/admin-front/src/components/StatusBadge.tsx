// Maps known status/enum strings to a flyonui badge color. Unknown values fall back to neutral.
const COLORS: Record<string, string> = {
  // incident
  open: "badge-warning",
  in_progress: "badge-info",
  resolved: "badge-success",
  closed: "badge-neutral",
  // listing
  active: "badge-success",
  expired: "badge-neutral",
  // event
  upcoming: "badge-info",
  ongoing: "badge-warning",
  completed: "badge-success",
  cancelled: "badge-error",
  // vote
  draft: "badge-neutral",
  // contract / signature
  sent: "badge-info",
  partially_signed: "badge-warning",
  signed: "badge-success",
  declined: "badge-error",
  // transaction
  credit: "badge-success",
  transfer_in: "badge-success",
  debit: "badge-error",
  transfer_out: "badge-error",
  // role
  user: "badge-neutral",
  admin: "badge-primary",
  superAdmin: "badge-secondary",
  // account status
  banned: "badge-error",
};

export function StatusBadge({ value }: { value: string }) {
  const color = COLORS[value] ?? "badge-neutral";
  return <span className={`badge badge-sm ${color}`}>{value}</span>;
}
