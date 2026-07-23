// DTO zod des conflits de synchronisation offline : un push client peut heurter
// l'état serveur ; ces schémas décrivent le conflit détecté, sa requête de listing
// et sa résolution.
import { z } from "../zod";
import { SyncEntitySchema } from "./sync.dto";

/** `duplicate` = collision de clé métier sur un premier INSERT ; `update` = jeton de concurrence optimiste périmé. */
export const ConflictTypeSchema = z.enum(["update", "duplicate"]);
export type ConflictType = z.infer<typeof ConflictTypeSchema>;

/** Cycle de vie d'un conflit : en attente ou résolu. */
export const ConflictStatusSchema = z.enum(["pending", "resolved"]);
export type ConflictStatus = z.infer<typeof ConflictStatusSchema>;

/** Choix de résolution : garder la version locale, celle du serveur, ou une fusion manuelle. */
export const ConflictResolutionSchema = z.enum(["local", "server", "merged"]);
export type ConflictResolution = z.infer<typeof ConflictResolutionSchema>;

/** Conflit tel que renvoyé à l'admin : snapshot local capté, doc serveur (expurgé), métadonnées. */
export const ConflictDtoSchema = z
  .object({
    id: z.string(),
    entity: SyncEntitySchema,
    mongoId: z.string(),
    type: ConflictTypeSchema,
    originInstanceId: z.string().openapi({ description: "Install whose push raised the conflict" }),
    localData: z.record(z.unknown()).openapi({ description: "The client's captured snapshot" }),
    serverData: z.record(z.unknown()).nullable().openapi({ description: "Redacted server document" }),
    baseUpdatedAt: z.string().datetime().optional(),
    status: ConflictStatusSchema,
    detectedAt: z.string().datetime(),
    resolvedAt: z.string().datetime().optional(),
    resolvedBy: z.string().optional(),
    resolution: ConflictResolutionSchema.optional(),
  })
  .openapi({ title: "Conflict" });
export type ConflictDto = z.infer<typeof ConflictDtoSchema>;

// Plafond de pagination de la liste des conflits.
export const CONFLICTS_LIMIT_MAX = 200;

/** Query de listing des conflits (filtres statut/entité/portée + pagination). */
export const ConflictQueryDtoSchema = z
  .object({
    status: ConflictStatusSchema.optional().default("pending"),
    entity: SyncEntitySchema.optional(),
    // Par défaut, les conflits du seul appelant ; `false` = vue globale réservée au superAdmin.
    // Query string → booléen : "true"/"false" transformés en vrai booléen.
    mine: z
      .enum(["true", "false"])
      .optional()
      .default("true")
      .transform((v) => v === "true"),
    limit: z.coerce.number().int().min(1).max(CONFLICTS_LIMIT_MAX).optional().default(100),
  })
  .openapi({ title: "ConflictQuery" });
export type ConflictQueryDto = z.infer<typeof ConflictQueryDtoSchema>;

export const ConflictParamsDtoSchema = z.object({ id: z.string() }).openapi({ title: "ConflictParams" });
export type ConflictParamsDto = z.infer<typeof ConflictParamsDtoSchema>;

// Corps de résolution d'un conflit. `data` (document fusionné) n'est requis que
// lorsque la résolution est `merged` — d'où le refine ci-dessous.
export const ResolveConflictDtoSchema = z
  .object({
    resolution: ConflictResolutionSchema,
    data: z.record(z.unknown()).optional().openapi({ description: "Required when resolution is `merged`" }),
  })
  .refine((v) => v.resolution !== "merged" || !!v.data, {
    message: "`data` is required when resolution is `merged`",
    path: ["data"],
  })
  .openapi({ title: "ResolveConflict" });
export type ResolveConflictDto = z.infer<typeof ResolveConflictDtoSchema>;

export const ResolveConflictResponseDtoSchema = z
  .object({
    id: z.string(),
    status: z.literal("resolved"),
    resolution: ConflictResolutionSchema,
  })
  .openapi({ title: "ResolveConflictResponse" });
export type ResolveConflictResponseDto = z.infer<typeof ResolveConflictResponseDtoSchema>;
