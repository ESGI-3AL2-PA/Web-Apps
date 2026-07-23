// Contexte React exposant les tags du quartier et deux helpers de traduction de libellé.
// Alimenté par TagsProvider ; consommé via le hook `useTags`.
import { createContext, useContext } from "react";
import type { TagResponseDto } from "@repo/contracts";

export type TagsContextValue = {
  tags: TagResponseDto[];
  // Traduit un objet tag complet dans la langue active.
  label: (tag: TagResponseDto) => string;
  // Traduit un tag référencé seulement par son nom/clé (ex. le tableau `tags` d'une
  // annonce), en retombant sur le nom brut si le tag n'est pas dans l'ensemble chargé.
  labelFor: (name: string) => string;
};

export const TagsContext = createContext<TagsContextValue | null>(null);

/** Accès au contexte des tags. Lève une erreur si utilisé hors d'un TagsProvider. */
export function useTags(): TagsContextValue {
  const ctx = useContext(TagsContext);
  if (!ctx) throw new Error("useTags must be used within TagsProvider");
  return ctx;
}
