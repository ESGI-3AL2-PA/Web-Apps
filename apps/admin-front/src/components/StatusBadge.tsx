// Composant : badge coloré pour un statut / rôle / type d'enum.
import { useTranslation } from "react-i18next";

// Associe chaque valeur d'enum connue à une couleur de badge flyonui.
// Toute valeur absente de la table retombe sur "badge-neutral".
const COLORS: Record<string, string> = {
  // signalement (incident)
  open: "badge-warning",
  in_progress: "badge-info",
  resolved: "badge-success",
  closed: "badge-neutral",
  // annonce (listing)
  active: "badge-success",
  expired: "badge-neutral",
  // événement
  upcoming: "badge-info",
  ongoing: "badge-warning",
  completed: "badge-success",
  cancelled: "badge-error",
  // vote / sondage
  draft: "badge-neutral",
  // contrat / signature
  sent: "badge-info",
  partially_signed: "badge-warning",
  signed: "badge-success",
  declined: "badge-error",
  // transaction de points
  credit: "badge-success",
  transfer_in: "badge-success",
  debit: "badge-error",
  transfer_out: "badge-error",
  // rôle
  user: "badge-neutral",
  admin: "badge-primary",
  superAdmin: "badge-secondary",
  // état du compte
  banned: "badge-error",
};

/**
 * Rend un badge dont la couleur reflète la valeur (via la table COLORS) et dont le
 * texte est traduit. Le libellé est cherché dans les namespaces i18n status/role/type
 * dans cet ordre ; à défaut de clé existante, la valeur brute est affichée telle quelle.
 */
export function StatusBadge({ value }: { value: string }) {
  const { t, i18n } = useTranslation();
  const color = COLORS[value] ?? "badge-neutral";
  // Première clé "status."/"role."/"type." + valeur qui existe réellement dans les traductions.
  const key = ["status", "role", "type"].map((ns) => `${ns}.${value}`).find((k) => i18n.exists(k));
  return <span className={`badge badge-sm ${color}`}>{key ? t(key) : value}</span>;
}
