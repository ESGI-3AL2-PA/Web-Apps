import i18n from "../i18n";

// Map the active i18next language to a BCP-47 locale for Intl formatting.
const locale = (): string => (i18n.language?.startsWith("en") ? "en-US" : "fr-FR");

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

export function formatTokens(n: number): string {
  return `${n.toLocaleString(locale())} ${i18n.t("common.points")}`;
}
