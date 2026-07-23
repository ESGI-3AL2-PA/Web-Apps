import { z } from "../zod";

/**
 * DTO (schémas zod) de la couche « administrateur de quartier ».
 *
 * Modélise la collection de jointure `district_admins` : chaque ligne associe un
 * utilisateur (`userId`) à un quartier (`districtId`) dont il est administrateur.
 * Expose les schémas de réponse, de création, de paramètres d'URL et de requête,
 * ainsi que les types TypeScript inférés correspondants.
 */

// Une ligne de la collection de jointure `district_admins` :
// « userId est administrateur du quartier districtId ».
export const DistrictAdminResponseDtoSchema = z
  .object({
    id: z.string().openapi({ description: "Unique district-admin assignment identifier" }),
    districtId: z.string().openapi({ description: "Target district ID" }),
    userId: z.string().openapi({ description: "ID of the user granted admin rights on this district" }),
    createdAt: z.string().datetime().openapi({ description: "Assignment timestamp" }),
  })
  .openapi({ title: "DistrictAdminResponse" });
export type DistrictAdminResponseDto = z.infer<typeof DistrictAdminResponseDtoSchema>;

// Corps de requête pour promouvoir un utilisateur administrateur d'un quartier.
export const CreateDistrictAdminDtoSchema = z
  .object({
    districtId: z.string().openapi({ description: "Target district ID" }),
    userId: z.string().openapi({ description: "User to promote to district admin" }),
  })
  .openapi({ title: "CreateDistrictAdmin" });
export type CreateDistrictAdminDto = z.infer<typeof CreateDistrictAdminDtoSchema>;

// Paramètre d'URL : identifiant de l'attribution.
export const DistrictAdminParamsDtoSchema = z.object({ id: z.string() }).openapi({ title: "DistrictAdminParams" });
export type DistrictAdminParamsDto = z.infer<typeof DistrictAdminParamsDtoSchema>;

// Query string de listing paginé, avec filtres facultatifs par quartier et par utilisateur.
export const DistrictAdminQueryDtoSchema = z
  .object({
    // Pagination : page >= 1, 20 résultats par défaut, plafonnée à 100 par page.
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    districtId: z.string().optional().openapi({ description: "Filter by district" }),
    userId: z.string().optional().openapi({ description: "Filter by user" }),
  })
  .openapi({ title: "DistrictAdminQuery" });
export type DistrictAdminQueryDto = z.infer<typeof DistrictAdminQueryDtoSchema>;
