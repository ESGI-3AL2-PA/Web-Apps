// Prices are integer *tokens* in this backend, not euros — label them honestly.
export const formatPrice = (price: number): string => `${price.toLocaleString("fr-FR")} pts`;

export const formatDate = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
};

export const formatDateTime = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleString("fr-FR", {
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
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `il y a ${days} j`;
  return formatDate(iso);
};

// Deterministic pastel background for listings without a photo, keyed by id.
const PLACEHOLDER_COLORS = ["#ffe3cf", "#e5eeff", "#e6f7ec", "#f4e6ff", "#fff5d6", "#ffe0e6"];
export const placeholderColor = (seed: string): string => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return PLACEHOLDER_COLORS[hash % PLACEHOLDER_COLORS.length]!;
};

export const typeLabel = (type: "offer" | "request"): string => (type === "offer" ? "Offre" : "Demande");
