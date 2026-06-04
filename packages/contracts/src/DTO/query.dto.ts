import { z } from "../zod";

/**
 * Query-string boolean. Unlike `z.coerce.boolean()` (which is `Boolean(value)` and turns the
 * string "false" into `true`), this maps "true" → true and "false" → false. Use for boolean
 * filter params that arrive as strings.
 */
export const BooleanQueryParamSchema = z.enum(["true", "false"]).transform((v) => v === "true");
