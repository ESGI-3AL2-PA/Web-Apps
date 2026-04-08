import { z } from "../zod";

export const NotFoundErrorSchema = z
  .object({
    message: z.string(),
  })
  .openapi({ title: "NotFoundError", description: "Resource not found error" });
export type NotFoundError = z.infer<typeof NotFoundErrorSchema>;
