import { z } from "../zod";

export const PaginatedResponseDtoSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    data: z.array(dataSchema).openapi({ description: "List of results" }),
    total: z.number().openapi({ description: "Total number of results" }),
    page: z.number().openapi({ description: "Current page number" }),
    limit: z.number().openapi({ description: "Number of results per page" }),
  });

export type PaginatedResponseDto<T extends z.ZodTypeAny> = z.infer<
  ReturnType<typeof PaginatedResponseDtoSchema<T>>
>;
