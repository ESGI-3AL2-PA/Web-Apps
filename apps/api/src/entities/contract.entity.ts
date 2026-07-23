import { z } from "zod";

// Entité Contract : matérialise un accord entre un prestataire et un bénéficiaire
// autour d'une annonce (listing), avec signature électronique déléguée à Documenso
// et séquestre (escrow) des points le temps de la signature.

// Cycle de vie de la signature du contrat, calqué sur le statut du document Documenso.
// draft     : ligne de contrat créée, document Documenso pas encore généré/envoyé.
// pending   : document envoyé, en attente d'une ou plusieurs signatures.
// completed : toutes les parties ont signé (Documenso DOCUMENT_COMPLETED).
// rejected  : une partie a refusé (Documenso DOCUMENT_REJECTED) — le séquestre est remboursé.
export const ContractSignatureStatusSchema = z.enum(["draft", "pending", "completed", "rejected"]);
export type ContractSignatureStatus = z.infer<typeof ContractSignatureStatusSchema>;

export const ContractSchema = z.object({
  id: z.string(),
  listingId: z.string(),
  districtId: z.string(),
  providerId: z.string(),
  beneficiaryId: z.string(),
  price: z.number().int().min(0),
  // Id (numérique) du document Documenso une fois généré ; null avant.
  documensoDocumentId: z.number().int().nullable(),
  signatureStatus: ContractSignatureStatusSchema,
  // URLs de signature Documenso propres à chaque partie ; null tant que le document n'est pas généré.
  providerSigningUrl: z.string().nullable(),
  beneficiarySigningUrl: z.string().nullable(),
  disputed: z.boolean().default(false),
  // Motif en texte libre saisi quand une partie ouvre un litige ; null sinon.
  disputeReason: z.string().nullable().default(null),
  createdAt: z.string().datetime(),
});

export type Contract = z.infer<typeof ContractSchema>;
