import { createContext, useContext } from "react";
import type { TagResponseDto } from "@repo/contracts";

export type TagsContextValue = {
  tags: TagResponseDto[];
  // Translate a tag object in the active language.
  label: (tag: TagResponseDto) => string;
  // Translate a tag referenced only by its name/key (e.g. a listing's tags array),
  // falling back to the raw name when the tag isn't in the loaded set.
  labelFor: (name: string) => string;
};

export const TagsContext = createContext<TagsContextValue | null>(null);

export function useTags(): TagsContextValue {
  const ctx = useContext(TagsContext);
  if (!ctx) throw new Error("useTags must be used within TagsProvider");
  return ctx;
}
