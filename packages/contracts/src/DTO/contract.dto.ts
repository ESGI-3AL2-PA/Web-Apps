import { z } from "../zod";

export const OpenSignStatusSchema = z.enum(["draft", "sent", "partially_signed", "signed", "expired", "declined"]);
export type OpenSignStatus = z.infer<typeof OpenSignStatusSchema>;

export const ContractResponseDtoSchema = z
  .object({
    id: z.string().openapi({ description: "Unique contract identifier" }),
    listingId: z.string().openapi({ description: "ID of the listing this contract was generated for" }),
    providerId: z.string().openapi({ description: "ID of the user providing the service" }),
    beneficiaryId: z.string().openapi({ description: "ID of the user benefiting from the service" }),
    price: z.number().int().openapi({ description: "Price in tokens", example: 10 }),
    openSignDocumentId: z.string().openapi({ description: "OpenSign document identifier" }),
    openSignStatus: OpenSignStatusSchema.openapi({ description: "Current OpenSign signature status" }),
    disputed: z.boolean().openapi({ description: "Whether the contract is currently disputed" }),
    createdAt: z.string().datetime().openapi({ description: "Creation timestamp" }),
  })
  .openapi({ title: "ContractResponse" });
export type ContractResponseDto = z.infer<typeof ContractResponseDtoSchema>;

export const CreateContractDtoSchema = z
  .object({
    listingId: z.string().openapi({ description: "ID of the listing this contract is generated for" }),
    providerId: z.string().openapi({ description: "ID of the user providing the service" }),
    beneficiaryId: z.string().openapi({ description: "ID of the user benefiting from the service" }),
    price: z.number().int().min(0).openapi({ description: "Price in tokens", example: 10 }),
  })
  .openapi({ title: "CreateContract" });
export type CreateContractDto = z.infer<typeof CreateContractDtoSchema>;

export const UpdateContractDtoSchema = z
  .object({
    openSignDocumentId: z.string().optional(),
    openSignStatus: OpenSignStatusSchema.optional(),
    disputed: z.boolean().optional(),
  })
  .openapi({ title: "UpdateContract" });
export type UpdateContractDto = z.infer<typeof UpdateContractDtoSchema>;

export const SignContractDtoSchema = z
  .object({
    openSignDocumentId: z.string().openapi({ description: "OpenSign document ID returned by the signature callback" }),
    openSignStatus: OpenSignStatusSchema.openapi({ description: "New OpenSign status reported by the callback" }),
  })
  .openapi({ title: "SignContract" });
export type SignContractDto = z.infer<typeof SignContractDtoSchema>;

export const DisputeContractDtoSchema = z
  .object({
    reason: z.string().min(1).openapi({ description: "Reason for raising the dispute" }),
  })
  .openapi({ title: "DisputeContract" });
export type DisputeContractDto = z.infer<typeof DisputeContractDtoSchema>;

export const ContractParamsDtoSchema = z.object({ id: z.string() }).openapi({ title: "ContractParams" });
export type ContractParamsDto = z.infer<typeof ContractParamsDtoSchema>;

export const ContractQueryDtoSchema = z
  .object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    listingId: z.string().optional(),
    providerId: z.string().optional(),
    beneficiaryId: z.string().optional(),
    openSignStatus: OpenSignStatusSchema.optional(),
    disputed: z.coerce.boolean().optional(),
  })
  .openapi({ title: "ContractQuery" });
export type ContractQueryDto = z.infer<typeof ContractQueryDtoSchema>;
