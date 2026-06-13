export type ListingResponseDto = {
  description: string;
  type: "offer" | "request";
  status: "active" | "closed" | "expired";
  id: string;
  title: string;
  price: number;
};

export type CreateListingDto = {
  title: string;
  description: string;
  type: "offer" | "request";
  price: number;
};

export const listingTypes = [
  "Jardinage",
  "Bricolage",
  "Garde d'enfants",
  "Cuisine",
  "Transport",
  "Animaux",
  "Informatique",
] as const;
