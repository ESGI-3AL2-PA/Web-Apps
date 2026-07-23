import { z } from "../zod";

/**
 * DTO (schéma zod) générique d'enveloppe de réponse paginée.
 *
 * Fabrique un schéma `{ data, total, page, limit }` à partir du schéma d'élément fourni,
 * afin que chaque contrat de listing réutilise la même forme d'enveloppe sans la redéclarer.
 *
 * @param dataSchema schéma zod d'un élément de la page
 * @returns un schéma objet dont `data` est un tableau de `dataSchema`
 */
export const PaginatedResponseDtoSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    data: z.array(dataSchema).openapi({ description: "List of results" }),
    total: z.number().openapi({ description: "Total number of results" }),
    page: z.number().openapi({ description: "Current page number" }),
    limit: z.number().openapi({ description: "Number of results per page" }),
  });

export type PaginatedResponseDto<T extends z.ZodTypeAny> = z.infer<ReturnType<typeof PaginatedResponseDtoSchema<T>>>;
