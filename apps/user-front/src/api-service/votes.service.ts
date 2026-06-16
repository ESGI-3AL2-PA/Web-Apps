import type {
  CreateVoteDto,
  PaginatedResponseDto,
  SubmitVoteResponseDto,
  UpdateVoteDto,
  VoteQueryDto,
  VoteResponseDto,
  VoteResponseDtoSchema,
  VoteResultsResponseDto,
} from "@repo/contracts";

type PaginatedVotes = PaginatedResponseDto<typeof VoteResponseDtoSchema>;

export async function getVotes(_filters: VoteQueryDto = {} as VoteQueryDto): Promise<PaginatedVotes> {
  throw new Error("Not implemented");
}

export async function getVoteById(_id: string): Promise<VoteResponseDto> {
  throw new Error("Not implemented");
}

export async function createVote(_data: CreateVoteDto): Promise<VoteResponseDto> {
  throw new Error("Not implemented");
}

export async function updateVote(_id: string, _data: UpdateVoteDto): Promise<VoteResponseDto> {
  throw new Error("Not implemented");
}

export async function deleteVote(_id: string): Promise<void> {
  throw new Error("Not implemented");
}

export async function submitVoteResponse(
  _id: string,
  _data: SubmitVoteResponseDto,
): Promise<VoteResponseDto> {
  throw new Error("Not implemented");
}

export async function getVoteResults(_id: string): Promise<VoteResultsResponseDto> {
  throw new Error("Not implemented");
}
