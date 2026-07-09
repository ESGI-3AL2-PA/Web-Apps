import { z } from "../zod";
import { BooleanQueryParamSchema } from "./query.dto";

// Contract signature lifecycle, mirrored from the Documenso document status.
export const ContractSignatureStatusSchema = z.enum(["draft", "pending", "completed", "rejected"]);
export type ContractSignatureStatus = z.infer<typeof ContractSignatureStatusSchema>;

export const ContractResponseDtoSchema = z
  .object({
    id: z.string().openapi({ description: "Unique contract identifier" }),
    listingId: z.string().openapi({ description: "ID of the listing this contract was generated for" }),
    districtId: z.string().openapi({ description: "District ID, derived from the referenced listing" }),
    providerId: z.string().openapi({ description: "ID of the user providing the service" }),
    beneficiaryId: z.string().openapi({ description: "ID of the user benefiting from the service" }),
    price: z.number().int().openapi({ description: "Price in tokens", example: 10 }),
    signatureStatus: ContractSignatureStatusSchema.openapi({ description: "Current signature lifecycle status" }),
    // The signing URL for the *authenticated caller only* (provider or beneficiary). Null for
    // admins/observers or once signing is done — never exposes the other party's signing token.
    signingUrl: z
      .string()
      .nullable()
      .openapi({ description: "Documenso signing URL for the current user, if they still need to sign" }),
    disputed: z.boolean().openapi({ description: "Whether the contract is currently disputed" }),
    disputeReason: z
      .string()
      .nullable()
      .openapi({ description: "Reason supplied when the contract was disputed, if any" }),
    createdAt: z.string().datetime().openapi({ description: "Creation timestamp" }),
  })
  .openapi({ title: "ContractResponse" });
export type ContractResponseDto = z.infer<typeof ContractResponseDtoSchema>;

export const CreateContractDtoSchema = z
  .object({
    listingId: z.string().openapi({ description: "ID of the listing this contract is generated for" }),
    // The authenticated caller is the beneficiary (payer, whose tokens are escrowed);
    // the provider being booked is named here and never derived from the client.
    providerId: z.string().openapi({ description: "ID of the user providing the service" }),
    // Price is NOT accepted from the client — it is derived server-side from the
    // referenced listing so the escrowed amount always matches the advertised price.
  })
  .openapi({ title: "CreateContract" });
export type CreateContractDto = z.infer<typeof CreateContractDtoSchema>;

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
    districtId: z.string().optional(),
    providerId: z.string().optional(),
    beneficiaryId: z.string().optional(),
    signatureStatus: ContractSignatureStatusSchema.optional(),
    disputed: BooleanQueryParamSchema.optional(),
  })
  .openapi({ title: "ContractQuery" });
export type ContractQueryDto = z.infer<typeof ContractQueryDtoSchema>;
