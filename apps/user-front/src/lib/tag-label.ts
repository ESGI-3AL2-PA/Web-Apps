/**
 * Helpers (lib) pour libeller les tags dans la langue active.
 */
import type { TagResponseDto } from "@repo/contracts";

export type TagLang = "fr" | "en";

/**
 * Réduit une langue i18next à `fr` ou `en`. i18next peut remonter des variantes
 * régionales (« en-US ») ; les tags ne portent que fr/en, avec fr par défaut.
 */
export function normalizeTagLang(lang: string): TagLang {
  return lang.toLowerCase().startsWith("en") ? "en" : "fr";
}

/** Libellé d'affichage d'un tag dans la langue active ; retombe sur la clé stable `name`. */
export function tagLabel(tag: TagResponseDto, lang: string): string {
  return tag.label?.[normalizeTagLang(lang)] || tag.name;
}
