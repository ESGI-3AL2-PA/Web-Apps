import { z } from "zod";

/**
 * Canonical schema for a document in the shared `district_admins` collection (join
 * between a user and the district they administer). Read by both backends — api has
 * full CRUD, auth-service reads it to resolve `adminDistrictId` at token time. The
 * read/write split is intentional; only the document shape + collection name are shared.
 */
export const districtAdminDocumentSchema = z.object({
  id: z.string(),
  districtId: z.string(),
  userId: z.string(),
  createdAt: z.string().datetime(),
});

export type DistrictAdminDocument = z.infer<typeof districtAdminDocumentSchema>;
