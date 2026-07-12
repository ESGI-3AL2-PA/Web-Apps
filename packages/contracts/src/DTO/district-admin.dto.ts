import { z } from "../zod";

// Represents the join `district_admins` collection — one row = "userId is admin of districtId".
export const DistrictAdminResponseDtoSchema = z
  .object({
    id: z.string().openapi({ description: "Unique district-admin assignment identifier" }),
    districtId: z.string().openapi({ description: "Target district ID" }),
    userId: z.string().openapi({ description: "ID of the user granted admin rights on this district" }),
    createdAt: z.string().datetime().openapi({ description: "Assignment timestamp" }),
  })
  .openapi({ title: "DistrictAdminResponse" });
export type DistrictAdminResponseDto = z.infer<typeof DistrictAdminResponseDtoSchema>;

export const CreateDistrictAdminDtoSchema = z
  .object({
    districtId: z.string().openapi({ description: "Target district ID" }),
    userId: z.string().openapi({ description: "User to promote to district admin" }),
  })
  .openapi({ title: "CreateDistrictAdmin" });
export type CreateDistrictAdminDto = z.infer<typeof CreateDistrictAdminDtoSchema>;

export const DistrictAdminParamsDtoSchema = z.object({ id: z.string() }).openapi({ title: "DistrictAdminParams" });
export type DistrictAdminParamsDto = z.infer<typeof DistrictAdminParamsDtoSchema>;

export const DistrictAdminQueryDtoSchema = z
  .object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    districtId: z.string().optional().openapi({ description: "Filter by district" }),
    userId: z.string().optional().openapi({ description: "Filter by user" }),
  })
  .openapi({ title: "DistrictAdminQuery" });
export type DistrictAdminQueryDto = z.infer<typeof DistrictAdminQueryDtoSchema>;
