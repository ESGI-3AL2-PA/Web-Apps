import { z } from "zod";

// Join entity between User and District — records that a user has admin
// privileges on a specific district. Stored in the Mongo `district_admins`
// collection with a unique compound index on `(districtId, userId)`.
export const DistrictAdminSchema = z.object({
  id: z.string(),
  districtId: z.string(),
  userId: z.string(),
  createdAt: z.string().datetime(),
});

export type DistrictAdmin = z.infer<typeof DistrictAdminSchema>;
