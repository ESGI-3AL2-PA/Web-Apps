import { describe, expect, it, vi } from "vitest";
import { CreateVoteDtoSchema } from "@repo/contracts";
import type { Vote } from "../../entities/vote.entity.js";
import { updateVoteUseCase, VoteDateRangeError } from "./update-vote.use-case.js";

const makeVote = (overrides: Partial<Vote> = {}): Vote => ({
  id: "vote-1",
  creatorId: "user-1",
  districtIds: ["district-1"],
  question: "Q?",
  options: ["A", "B"],
  voteType: "single_choice",
  status: "draft",
  results: [],
  startDate: "2026-07-01T00:00:00.000Z",
  endDate: "2026-07-10T00:00:00.000Z",
  ...overrides,
});

const makeRepo = (existing: Vote | null) => ({
  ensureIndexes: vi.fn(),
  getVotes: vi.fn(),
  getVoteById: vi.fn().mockResolvedValue(existing),
  createVote: vi.fn(),
  updateVote: vi
    .fn()
    .mockImplementation(async (id: string, data: Partial<Vote>) => ({ ...(existing as Vote), ...data })),
  deleteVote: vi.fn(),
  submitResponse: vi.fn(),
  clearUserResponses: vi.fn(),
  deleteUserResponses: vi.fn(),
  getResults: vi.fn(),
});

describe("CreateVoteDtoSchema date range", () => {
  const base = {
    districtIds: ["d1"],
    question: "Q?",
    options: ["A", "B"],
    voteType: "single_choice" as const,
  };

  it("rejects endDate before startDate", () => {
    const parsed = CreateVoteDtoSchema.safeParse({
      ...base,
      startDate: "2026-07-29T00:00:00.000Z",
      endDate: "2026-07-22T00:00:00.000Z",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects endDate equal to startDate", () => {
    const parsed = CreateVoteDtoSchema.safeParse({
      ...base,
      startDate: "2026-07-22T00:00:00.000Z",
      endDate: "2026-07-22T00:00:00.000Z",
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts endDate after startDate", () => {
    const parsed = CreateVoteDtoSchema.safeParse({
      ...base,
      startDate: "2026-07-22T00:00:00.000Z",
      endDate: "2026-07-29T00:00:00.000Z",
    });
    expect(parsed.success).toBe(true);
  });
});

describe("updateVoteUseCase date range guard", () => {
  it("throws when a patched startDate lands after the stored endDate", async () => {
    const repo = makeRepo(makeVote());
    await expect(updateVoteUseCase(repo)("vote-1", { startDate: "2026-07-20T00:00:00.000Z" })).rejects.toBeInstanceOf(
      VoteDateRangeError,
    );
    expect(repo.updateVote).not.toHaveBeenCalled();
  });

  it("throws when a patched endDate lands before the stored startDate", async () => {
    const repo = makeRepo(makeVote());
    await expect(updateVoteUseCase(repo)("vote-1", { endDate: "2026-06-01T00:00:00.000Z" })).rejects.toBeInstanceOf(
      VoteDateRangeError,
    );
  });

  it("returns null for a missing vote without throwing", async () => {
    const repo = makeRepo(null);
    await expect(updateVoteUseCase(repo)("missing", { endDate: "2026-08-01T00:00:00.000Z" })).resolves.toBeNull();
  });

  it("allows a valid date patch through to the repo", async () => {
    const repo = makeRepo(makeVote());
    const result = await updateVoteUseCase(repo)("vote-1", { endDate: "2026-07-15T00:00:00.000Z" });
    expect(repo.updateVote).toHaveBeenCalledWith("vote-1", { endDate: "2026-07-15T00:00:00.000Z" });
    expect(result).not.toBeNull();
  });

  it("skips the lookup entirely when no date field is patched", async () => {
    const repo = makeRepo(makeVote());
    await updateVoteUseCase(repo)("vote-1", { question: "New?" });
    expect(repo.getVoteById).not.toHaveBeenCalled();
    expect(repo.updateVote).toHaveBeenCalledWith("vote-1", { question: "New?" });
  });
});
