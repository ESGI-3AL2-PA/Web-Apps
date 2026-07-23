// Utilitaires de formatage (dates, points) localisés selon la langue i18next active.
import i18n from "../i18n";

// Convertit la langue i18next active en locale BCP-47 pour le formatage Intl.
const locale = (): string => (i18n.language?.startsWith("en") ? "en-US" : "fr-FR");

/** Formate une date ISO en date/heure localisée ; renvoie "—" si absente, l'ISO brut si invalide. */
export function formatDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(locale(), {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Formate un nombre de points avec séparateurs de milliers localisés + le libellé "points". */
export function formatTokens(n: number): string {
  return `${n.toLocaleString(locale())} ${i18n.t("common.points")}`;
}
