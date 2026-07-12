import type { EventStatus } from "@repo/contracts";

// Single source of the French status labels, shared by the filter dropdown and the
// event cards/modal so a status is never shown as the raw English enum.
export const STATUS_LABELS: Record<EventStatus, string> = {
  upcoming: "À venir",
  ongoing: "En cours",
  completed: "Terminés",
  cancelled: "Annulés",
};

export const statusLabel = (s: EventStatus): string => STATUS_LABELS[s] ?? s;
