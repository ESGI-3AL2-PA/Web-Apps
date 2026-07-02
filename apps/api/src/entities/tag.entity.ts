import { z } from "zod";

export const TagSchema = z.object({
  id: z.string(),
  districtId: z.string(),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
});

export type Tag = z.infer<typeof TagSchema>;
