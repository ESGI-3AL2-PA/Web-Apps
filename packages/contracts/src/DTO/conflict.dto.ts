import { z } from "../zod";
import { SyncEntitySchema } from "./sync.dto";

/** `duplicate` = business-key collision on a first INSERT; `update` = stale optimistic-concurrency token. */
export const ConflictTypeSchema = z.enum(["update", "duplicate"]);
export type ConflictType = z.infer<typeof ConflictTypeSchema>;

export const ConflictStatusSchema = z.enum(["pending", "resolved"]);
export type ConflictStatus = z.infer<typeof ConflictStatusSchema>;

export const ConflictResolutionSchema = z.enum(["local", "server", "merged"]);
export type ConflictResolution = z.infer<typeof ConflictResolutionSchema>;

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

export const CONFLICTS_LIMIT_MAX = 200;

export const ConflictQueryDtoSchema = z
  .object({
    status: ConflictStatusSchema.optional().default("pending"),
    entity: SyncEntitySchema.optional(),
    // Defaults to the caller's own conflicts; `false` is a superAdmin-only full view.
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
