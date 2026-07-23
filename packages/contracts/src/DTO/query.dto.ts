import { z } from "../zod";

/**
 * Schémas zod utilitaires pour les paramètres de query string.
 */

/**
 * Booléen de query string. Contrairement à `z.coerce.boolean()` (qui applique `Boolean(value)` et
 * transforme donc la chaîne "false" en `true`), ce schéma mappe "true" → true et "false" → false.
 * À utiliser pour les filtres booléens qui arrivent sous forme de chaîne.
 */
export const BooleanQueryParamSchema = z.enum(["true", "false"]).transform((v) => v === "true");
