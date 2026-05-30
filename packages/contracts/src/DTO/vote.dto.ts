import { z } from "../zod";

export const VoteTypeSchema = z.enum(["single_choice", "multiple_choice"]);
export type VoteType = z.infer<typeof VoteTypeSchema>;

export const VoteStatusSchema = z.enum(["draft", "open", "closed"]);
export type VoteStatus = z.infer<typeof VoteStatusSchema>;

export const VoteResultEntrySchema = z
  .object({
    option: z.string().openapi({ description: "Option label" }),
    count: z.number().int().openapi({ description: "Number of votes for this option" }),
  })
  .openapi({ title: "VoteResultEntry" });
export type VoteResultEntry = z.infer<typeof VoteResultEntrySchema>;

export const VoteResponseDtoSchema = z
  .object({
    id: z.string().openapi({ description: "Unique vote identifier" }),
    creatorId: z.string().openapi({ description: "ID of the user who created the vote" }),
    districtIds: z.array(z.string()).openapi({ description: "IDs of the districts concerned" }),
    question: z.string().openapi({ description: "Vote question" }),
    options: z.array(z.string()).openapi({ description: "Available options" }),
    voteType: VoteTypeSchema.openapi({ description: "single_choice or multiple_choice" }),
    status: VoteStatusSchema.openapi({ description: "Current vote status" }),
    results: z.array(VoteResultEntrySchema).openapi({ description: "Aggregated results" }),
    startDate: z.string().datetime().openapi({ description: "Vote start date" }),
    endDate: z.string().datetime().openapi({ description: "Vote end date" }),
  })
  .openapi({ title: "VoteResponse" });
export type VoteResponseDto = z.infer<typeof VoteResponseDtoSchema>;

export const CreateVoteDtoSchema = z
  .object({
    districtIds: z.array(z.string()).min(1).openapi({ description: "Districts concerned" }),
    question: z.string().min(1).max(500).openapi({ description: "Vote question" }),
    options: z.array(z.string().min(1)).min(2).openapi({ description: "At least two options" }),
    voteType: VoteTypeSchema,
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
  })
  .openapi({ title: "CreateVote" });
export type CreateVoteDto = z.infer<typeof CreateVoteDtoSchema>;

export const UpdateVoteDtoSchema = z
  .object({
    question: z.string().min(1).max(500).optional(),
    options: z.array(z.string().min(1)).min(2).optional(),
    voteType: VoteTypeSchema.optional(),
    status: VoteStatusSchema.optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  })
  .openapi({ title: "UpdateVote" });
export type UpdateVoteDto = z.infer<typeof UpdateVoteDtoSchema>;

export const VoteParamsDtoSchema = z.object({ id: z.string() }).openapi({ title: "VoteParams" });
export type VoteParamsDto = z.infer<typeof VoteParamsDtoSchema>;

export const VoteQueryDtoSchema = z
  .object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    search: z.string().optional(),
    status: VoteStatusSchema.optional(),
    districtId: z.string().optional(),
    creatorId: z.string().optional(),
  })
  .openapi({ title: "VoteQuery" });
export type VoteQueryDto = z.infer<typeof VoteQueryDtoSchema>;

export const SubmitVoteResponseDtoSchema = z
  .object({
    userId: z.string().openapi({ description: "ID of the user casting the vote" }),
    chosenOption: z.string().openapi({ description: "Option chosen by the user" }),
  })
  .openapi({ title: "SubmitVoteResponse" });
export type SubmitVoteResponseDto = z.infer<typeof SubmitVoteResponseDtoSchema>;

export const VoteResultsResponseDtoSchema = z
  .object({
    voteId: z.string(),
    totalResponses: z.number().int(),
    results: z.array(VoteResultEntrySchema),
  })
  .openapi({ title: "VoteResultsResponse" });
export type VoteResultsResponseDto = z.infer<typeof VoteResultsResponseDtoSchema>;
