// DTO zod des contrats de service : un contrat lie une annonce, un prestataire et un
// bénéficiaire ; il séquestre des points, se signe via Documenso et peut être disputé.
import { z } from "../zod";
import { BooleanQueryParamSchema } from "./query.dto";

// Cycle de vie de la signature, calqué sur le statut du document Documenso.
export const ContractSignatureStatusSchema = z.enum(["draft", "pending", "completed", "rejected"]);
export type ContractSignatureStatus = z.infer<typeof ContractSignatureStatusSchema>;

/** Contrat renvoyé au client. `signingUrl` est propre à l'appelant authentifié (voir plus bas). */
export const ContractResponseDtoSchema = z
  .object({
    id: z.string().openapi({ description: "Unique contract identifier" }),
    listingId: z.string().openapi({ description: "ID of the listing this contract was generated for" }),
    districtId: z.string().openapi({ description: "District ID, derived from the referenced listing" }),
    providerId: z.string().openapi({ description: "ID of the user providing the service" }),
    beneficiaryId: z.string().openapi({ description: "ID of the user benefiting from the service" }),
    price: z.number().int().openapi({ description: "Price in tokens", example: 10 }),
    signatureStatus: ContractSignatureStatusSchema.openapi({ description: "Current signature lifecycle status" }),
    // URL de signature pour le *seul appelant authentifié* (prestataire ou bénéficiaire).
    // Null pour les admins/observateurs ou une fois la signature faite — n'expose jamais
    // le jeton de signature de l'autre partie.
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

// Création d'un contrat : l'appelant authentifié est le bénéficiaire (payeur).
export const CreateContractDtoSchema = z
  .object({
    listingId: z.string().openapi({ description: "ID of the listing this contract is generated for" }),
    // L'appelant authentifié est le bénéficiaire (payeur, dont les points sont mis sous séquestre) ;
    // le prestataire réservé est nommé ici et jamais dérivé du client.
    providerId: z.string().openapi({ description: "ID of the user providing the service" }),
    // Le prix N'EST PAS accepté depuis le client — il est dérivé côté serveur depuis
    // l'annonce référencée, pour que le montant séquestré colle toujours au prix affiché.
  })
  .openapi({ title: "CreateContract" });
export type CreateContractDto = z.infer<typeof CreateContractDtoSchema>;

// Ouverture d'un litige sur un contrat : motif obligatoire.
export const DisputeContractDtoSchema = z
  .object({
    reason: z.string().min(1).openapi({ description: "Reason for raising the dispute" }),
  })
  .openapi({ title: "DisputeContract" });
export type DisputeContractDto = z.infer<typeof DisputeContractDtoSchema>;

// Résolution d'un litige par un admin : choix du dénouement du séquestre.
export const ResolveDisputeDtoSchema = z
  .object({
    // Décision de règlement de l'admin : libérer le séquestre au prestataire, ou le
    // rembourser au bénéficiaire. Déclenche le mouvement de points à la résolution.
    resolution: z
      .enum(["release", "refund"])
      .openapi({ description: "Escrow settlement outcome: release to provider or refund to beneficiary" }),
  })
  .openapi({ title: "ResolveDispute" });
export type ResolveDisputeDto = z.infer<typeof ResolveDisputeDtoSchema>;

export const ContractParamsDtoSchema = z.object({ id: z.string() }).openapi({ title: "ContractParams" });
export type ContractParamsDto = z.infer<typeof ContractParamsDtoSchema>;

// Query de listing des contrats : pagination + filtres (annonce, quartier, parties, statut, disputé).
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
