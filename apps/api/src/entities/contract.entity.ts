import { z } from "zod";

export const OpenSignStatusSchema = z.enum(["draft", "sent", "partially_signed", "signed", "expired", "declined"]);
export type OpenSignStatus = z.infer<typeof OpenSignStatusSchema>;

export const ContractSchema = z.object({
  id: z.string(),
  listingId: z.string(),
  districtId: z.string(),
  providerId: z.string(),
  beneficiaryId: z.string(),
  price: z.number().int().min(0),
  openSignDocumentId: z.string(),
  openSignStatus: OpenSignStatusSchema,
  disputed: z.boolean().default(false),
  createdAt: z.string().datetime(),
});

export type Contract = z.infer<typeof ContractSchema>;
