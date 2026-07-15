import type { TagResponseDto } from "@repo/contracts";

export type TagLang = "fr" | "en";

// i18next may report region variants ("en-US"); tags only carry fr/en, default fr.
export function normalizeTagLang(lang: string): TagLang {
  return lang.toLowerCase().startsWith("en") ? "en" : "fr";
}

// Display text for a tag in the active language, falling back to the stable key.
export function tagLabel(tag: TagResponseDto, lang: string): string {
  return tag.label?.[normalizeTagLang(lang)] || tag.name;
}
