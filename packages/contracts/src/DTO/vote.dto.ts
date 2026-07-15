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
    search: z.string().max(200).optional(),
    status: VoteStatusSchema.optional(),
    districtId: z.string().optional(),
    creatorId: z.string().optional(),
  })
  .openapi({ title: "VoteQuery" });
export type VoteQueryDto = z.infer<typeof VoteQueryDtoSchema>;
export type VoteQueryInput = z.input<typeof VoteQueryDtoSchema>;

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

export const VoteResultsResponseDtoSchema = z
  .object({
    voteId: z.string(),
    totalResponses: z.number().int(),
    results: z.array(VoteResultEntrySchema),
  })
  .openapi({ title: "VoteResultsResponse" });
export type VoteResultsResponseDto = z.infer<typeof VoteResultsResponseDtoSchema>;
