/**
 * Helpers de formatage (lib) : prix, dates et couleurs de remplissage.
 *
 * S'appuie sur la langue i18next active pour choisir la locale Intl, et sur les
 * clés de traduction pour les libellés (points, temps relatif).
 */
import i18n from "../i18n";

// Traduit la langue i18next active en locale BCP-47 pour le formatage Intl.
const locale = (): string => (i18n.language?.startsWith("en") ? "en-US" : "fr-FR");

/** Formate un prix. Les prix sont des *points* entiers côté backend, pas des euros. */
export const formatPrice = (price: number): string => `${price.toLocaleString(locale())} ${i18n.t("common.points")}`;

/** Formate une date ISO en date longue localisée (ex. « 3 juin 2026 »). */
export const formatDate = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleDateString(locale(), { day: "numeric", month: "long", year: "numeric" });
};

/** Formate une date ISO en date + heure localisées (jour abrégé, heure:minute). */
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

/**
 * Formate un temps relatif (« à l'instant », « il y a 5 min », …). Au-delà de
 * 30 jours, bascule sur une date absolue via `formatDate`.
 */
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

// Fond pastel déterministe pour les annonces sans photo, dérivé de l'identifiant.
const PLACEHOLDER_COLORS = ["#ffe3cf", "#e5eeff", "#e6f7ec", "#f4e6ff", "#fff5d6", "#ffe0e6"];
/**
 * Renvoie une couleur de remplissage stable pour une graine donnée : un même
 * `seed` produit toujours la même couleur (hash polynomial modulo la palette).
 */
export const placeholderColor = (seed: string): string => {
  let hash = 0;
  // Hash polynomial base 31 ; `>>> 0` garde la valeur dans un entier 32 bits non signé.
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return PLACEHOLDER_COLORS[hash % PLACEHOLDER_COLORS.length]!;
};
