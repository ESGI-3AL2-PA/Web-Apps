import { z } from "zod";

// Contract signature lifecycle, mirrored from the Documenso document status.
// draft: contract row created, Documenso document not yet generated/sent.
// pending: document sent, awaiting one or more signatures.
// completed: every party has signed (Documenso DOCUMENT_COMPLETED).
// rejected: a party declined (Documenso DOCUMENT_REJECTED) — also flags `disputed`.
export const ContractSignatureStatusSchema = z.enum(["draft", "pending", "completed", "rejected"]);
export type ContractSignatureStatus = z.infer<typeof ContractSignatureStatusSchema>;

export const ContractSchema = z.object({
  id: z.string(),
  listingId: z.string(),
  districtId: z.string(),
  providerId: z.string(),
  beneficiaryId: z.string(),
  price: z.number().int().min(0),
  // Documenso document id (numeric) once the document is generated; null before.
  documensoDocumentId: z.number().int().nullable(),
  signatureStatus: ContractSignatureStatusSchema,
  // Per-party Documenso signing URLs; null until the document is generated.
  providerSigningUrl: z.string().nullable(),
  beneficiarySigningUrl: z.string().nullable(),
  disputed: z.boolean().default(false),
  createdAt: z.string().datetime(),
});

export type Contract = z.infer<typeof ContractSchema>;
