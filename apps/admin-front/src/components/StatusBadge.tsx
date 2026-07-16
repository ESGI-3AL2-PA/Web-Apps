import { useTranslation } from "react-i18next";

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
  const { t, i18n } = useTranslation();
  const color = COLORS[value] ?? "badge-neutral";
  // Resolve a label from the status/role/type namespaces, falling back to the raw value.
  const key = ["status", "role", "type"].map((ns) => `${ns}.${value}`).find((k) => i18n.exists(k));
  return <span className={`badge badge-sm ${color}`}>{key ? t(key) : value}</span>;
}
