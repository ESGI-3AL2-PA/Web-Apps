import { z } from "zod";

export const NotFoundErrorSchema = z.object({
  message: z.string(),
});
export type NotFoundError = z.infer<typeof NotFoundErrorSchema>;
