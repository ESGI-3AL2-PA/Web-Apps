// Entity — schémas zod du vote / sondage et de ses réponses.
// Expose le vote (question + options + résultats agrégés) et l'enregistrement d'une réponse
// individuelle (VoteResponse), un document par choix exprimé.
import { z } from "zod";

// Choix unique vs. choix multiple : détermine combien d'options un votant peut sélectionner.
export const VoteTypeSchema = z.enum(["single_choice", "multiple_choice"]);
export type VoteType = z.infer<typeof VoteTypeSchema>;

// Cycle de vie : brouillon (non publié) → ouvert (accepte les réponses) → clos.
export const VoteStatusSchema = z.enum(["draft", "open", "closed"]);
export type VoteStatus = z.infer<typeof VoteStatusSchema>;

// Résultat agrégé pour une option : le libellé de l'option et son nombre de voix.
export const VoteResultEntrySchema = z.object({
  option: z.string(),
  count: z.number().int(),
});
export type VoteResultEntry = z.infer<typeof VoteResultEntrySchema>;

/** Vote / sondage : rattaché à un ou plusieurs quartiers (`districtIds`), avec ses résultats agrégés. */
export const VoteSchema = z.object({
  id: z.string(),
  creatorId: z.string(),
  districtIds: z.array(z.string()),
  question: z.string(),
  options: z.array(z.string()),
  voteType: VoteTypeSchema,
  status: VoteStatusSchema,
  results: z.array(VoteResultEntrySchema),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  // Champs dérivés ajoutés à la lecture (enrichWithUserVotes), pas stockés en base.
  totalResponses: z.number().int().optional(),
  userHasVoted: z.boolean().optional(),
  myChosenOptions: z.array(z.string()).optional(),
});
export type Vote = z.infer<typeof VoteSchema>;

/** Réponse individuelle : une ligne par option choisie par un utilisateur (`chosenOption`). */
export const VoteResponseSchema = z.object({
  id: z.string(),
  voteId: z.string(),
  userId: z.string(),
  chosenOption: z.string(),
  votedAt: z.string().datetime(),
});
export type VoteResponseEntity = z.infer<typeof VoteResponseSchema>;
