import type { ListingStatus } from "@repo/contracts";

// Type/status display labels are resolved via i18n (keys `listing.type.*` / `listing.status.*`).
// Only the presentational badge colour stays here.
export const listingStatusBadgeClass: Record<ListingStatus, string> = {
  active: "badge-success",
  closed: "badge-neutral",
  expired: "badge-warning",
};
