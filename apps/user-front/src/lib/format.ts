import i18n from "../i18n";

// Map the active i18next language to a BCP-47 locale for Intl formatting.
const locale = (): string => (i18n.language?.startsWith("en") ? "en-US" : "fr-FR");

// Prices are integer *tokens* in this backend, not euros — label them honestly.
export const formatPrice = (price: number): string => `${price.toLocaleString(locale())} pts`;

export const formatDate = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleDateString(locale(), { day: "numeric", month: "long", year: "numeric" });
};

export const formatDateTime = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleString(locale(), {
    weekday: "short",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const formatRelative = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return i18n.t("relative.now");
  if (mins < 60) return i18n.t("relative.minutes", { count: mins });
  const hours = Math.round(mins / 60);
  if (hours < 24) return i18n.t("relative.hours", { count: hours });
  const days = Math.round(hours / 24);
  if (days < 30) return i18n.t("relative.days", { count: days });
  return formatDate(iso);
};

// Deterministic pastel background for listings without a photo, keyed by id.
const PLACEHOLDER_COLORS = ["#ffe3cf", "#e5eeff", "#e6f7ec", "#f4e6ff", "#fff5d6", "#ffe0e6"];
export const placeholderColor = (seed: string): string => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return PLACEHOLDER_COLORS[hash % PLACEHOLDER_COLORS.length]!;
};
