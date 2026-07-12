import { z } from "zod";

export const VoteTypeSchema = z.enum(["single_choice", "multiple_choice"]);
export type VoteType = z.infer<typeof VoteTypeSchema>;

export const VoteStatusSchema = z.enum(["draft", "open", "closed"]);
export type VoteStatus = z.infer<typeof VoteStatusSchema>;

export const VoteResultEntrySchema = z.object({
  option: z.string(),
  count: z.number().int(),
});
export type VoteResultEntry = z.infer<typeof VoteResultEntrySchema>;

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
  // Champs dérivés ajoutés à la lecture (enrichWithUserVotes), pas stockés.
  totalResponses: z.number().int().optional(),
  userHasVoted: z.boolean().optional(),
  myChosenOptions: z.array(z.string()).optional(),
});
export type Vote = z.infer<typeof VoteSchema>;

export const VoteResponseSchema = z.object({
  id: z.string(),
  voteId: z.string(),
  userId: z.string(),
  chosenOption: z.string(),
  votedAt: z.string().datetime(),
});
export type VoteResponseEntity = z.infer<typeof VoteResponseSchema>;
