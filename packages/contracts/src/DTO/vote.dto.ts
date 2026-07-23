// DTO (couche contracts) : schémas zod des votes / sondages de quartier. Couvre la
// vue de réponse (avec masquage des résultats tant que l'appelant n'a pas voté), la
// création, la mise à jour, le listing, la soumission d'un bulletin et l'agrégation
// des résultats.
import { z } from "../zod";

/** Modalité du vote : choix unique ou choix multiple. */
export const VoteTypeSchema = z.enum(["single_choice", "multiple_choice"]);
export type VoteType = z.infer<typeof VoteTypeSchema>;

/** Cycle de vie d'un vote : brouillon, ouvert, clôturé. */
export const VoteStatusSchema = z.enum(["draft", "open", "closed"]);
export type VoteStatus = z.infer<typeof VoteStatusSchema>;

/** Entrée de résultat agrégé : le nombre de voix pour une option donnée. */
export const VoteResultEntrySchema = z
  .object({
    option: z.string().openapi({ description: "Option label" }),
    count: z.number().int().openapi({ description: "Number of votes for this option" }),
  })
  .openapi({ title: "VoteResultEntry" });
export type VoteResultEntry = z.infer<typeof VoteResultEntrySchema>;

// Vote renvoyé par l'API. Confidentialité du dépouillement : les compteurs par option
// (`results`) restent à zéro tant que l'appelant n'a pas voté ou que le vote n'est pas
// clôturé, alors que `totalResponses` reste toujours visible. `userHasVoted` /
// `myChosenOptions` renseignent l'état personnel de l'appelant.
/** Vote / sondage renvoyé par l'API, avec résultats masqués jusqu'au vote ou à la clôture. */
export const VoteResponseDtoSchema = z
  .object({
    id: z.string().openapi({ description: "Unique vote identifier" }),
    creatorId: z.string().openapi({ description: "ID of the user who created the vote" }),
    districtIds: z.array(z.string()).openapi({ description: "IDs of the districts concerned" }),
    question: z.string().openapi({ description: "Vote question" }),
    options: z.array(z.string()).openapi({ description: "Available options" }),
    voteType: VoteTypeSchema.openapi({ description: "single_choice or multiple_choice" }),
    status: VoteStatusSchema.openapi({ description: "Current vote status" }),
    results: z.array(VoteResultEntrySchema).openapi({
      description: "Aggregated results — per-option counts are zeroed until the caller has voted or the vote is closed",
    }),
    totalResponses: z
      .number()
      .int()
      .optional()
      .openapi({ description: "Total number of responses — always visible, even before the breakdown is revealed" }),
    startDate: z.string().datetime().openapi({ description: "Vote start date" }),
    endDate: z.string().datetime().openapi({ description: "Vote end date" }),
    userHasVoted: z.boolean().optional().openapi({ description: "True if the current user has already voted" }),
    myChosenOptions: z
      .array(z.string())
      .optional()
      .openapi({ description: "Options chosen by the current user (empty if not yet voted)" }),
  })
  .openapi({ title: "VoteResponse" });
export type VoteResponseDto = z.infer<typeof VoteResponseDtoSchema>;

/** Corps de création d'un vote : au moins un quartier, une question (1..500) et au moins deux options. */
export const CreateVoteDtoSchema = z
  .object({
    districtIds: z.array(z.string()).min(1).openapi({ description: "Districts concerned" }),
    question: z.string().min(1).max(500).openapi({ description: "Vote question" }),
    options: z.array(z.string().min(1)).min(2).openapi({ description: "At least two options" }),
    voteType: VoteTypeSchema,
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
  })
  .refine((data) => new Date(data.endDate) > new Date(data.startDate), {
    message: "endDate must be after startDate",
    path: ["endDate"],
  })
  .openapi({ title: "CreateVote" });
export type CreateVoteDto = z.infer<typeof CreateVoteDtoSchema>;

/** Corps de mise à jour partielle d'un vote (permet aussi de changer son `status`, ex. ouvrir/clôturer). */
export const UpdateVoteDtoSchema = z
  .object({
    question: z.string().min(1).max(500).optional(),
    options: z.array(z.string().min(1)).min(2).optional(),
    voteType: VoteTypeSchema.optional(),
    status: VoteStatusSchema.optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  })
  // Vérifiable ici uniquement quand les deux bornes sont dans le même patch ; un patch qui ne
  // déplace qu'une seule borne au-delà de l'autre borne stockée est contrôlé dans le use-case de mise à jour.
  .refine((data) => !(data.startDate && data.endDate) || new Date(data.endDate) > new Date(data.startDate), {
    message: "endDate must be after startDate",
    path: ["endDate"],
  })
  .openapi({ title: "UpdateVote" });
export type UpdateVoteDto = z.infer<typeof UpdateVoteDtoSchema>;

/** Param de route : identifiant du vote ciblé. */
export const VoteParamsDtoSchema = z.object({ id: z.string() }).openapi({ title: "VoteParams" });
export type VoteParamsDto = z.infer<typeof VoteParamsDtoSchema>;

/** Query de listing des votes : pagination, recherche texte et filtres par statut, quartier et créateur. */
export const VoteQueryDtoSchema = z
  .object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    search: z.string().max(200).optional(),
    status: VoteStatusSchema.optional(),
    districtId: z.string().optional(),
    creatorId: z.string().optional(),
  })
  .openapi({ title: "VoteQuery" });
export type VoteQueryDto = z.infer<typeof VoteQueryDtoSchema>;
export type VoteQueryInput = z.input<typeof VoteQueryDtoSchema>;

// Bulletin soumis : `chosenOption` pour un vote à choix unique, `chosenOptions` pour
// un vote à choix multiple. Le refine impose qu'au moins l'un des deux soit renseigné.
/** Corps de soumission d'un bulletin de vote (option unique ou options multiples selon la modalité). */
export const SubmitVoteResponseDtoSchema = z
  .object({
    chosenOption: z.string().optional().openapi({ description: "Option unique (single_choice)" }),
    chosenOptions: z.array(z.string()).optional().openapi({ description: "Options multiples (multiple_choice)" }),
  })
  .refine((data) => Boolean(data.chosenOption) || Boolean(data.chosenOptions && data.chosenOptions.length > 0), {
    message: "chosenOption or chosenOptions is required",
  })
  .openapi({ title: "SubmitVoteResponse" });
export type SubmitVoteResponseDto = z.infer<typeof SubmitVoteResponseDtoSchema>;

/** Résultats agrégés d'un vote : total des réponses et décompte par option. */
export const VoteResultsResponseDtoSchema = z
  .object({
    voteId: z.string(),
    totalResponses: z.number().int(),
    results: z.array(VoteResultEntrySchema),
  })
  .openapi({ title: "VoteResultsResponse" });
export type VoteResultsResponseDto = z.infer<typeof VoteResultsResponseDtoSchema>;
