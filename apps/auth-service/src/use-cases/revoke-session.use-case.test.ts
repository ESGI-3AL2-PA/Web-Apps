import { describe, expect, it, vi } from "vitest";
import type { IRefreshTokenRepository } from "../repositories/RefreshToken/refresh-token.repository.js";
import { revokeSessionUseCase } from "./revoke-session.use-case.js";

type RefreshRepoMock = {
  [K in keyof IRefreshTokenRepository]: ReturnType<typeof vi.fn>;
};

const makeRefreshRepo = (): RefreshRepoMock => ({
  create: vi.fn(),
  findActiveByTokenHash: vi.fn(),
  claimByTokenHash: vi.fn(),
  findByTokenHash: vi.fn(),
  findActiveByUserId: vi.fn(),
  revokeByTokenHash: vi.fn(),
  revokeById: vi.fn(),
  revokeBySessionId: vi.fn().mockResolvedValue(true),
  revokeAllForUser: vi.fn(),
  deleteAllForUser: vi.fn(),
});

describe("revokeSessionUseCase", () => {
  it("forwards BOTH sessionId and the caller's userId to scope the revoke (IDOR guard)", async () => {
    const repo = makeRefreshRepo();
    const revokeSession = revokeSessionUseCase(repo as unknown as IRefreshTokenRepository);

    const result = await revokeSession("user-A", "session-1");

    expect(result).toBe(true);
    // The userId MUST be forwarded — dropping it would let one user revoke another's session.
    expect(repo.revokeBySessionId).toHaveBeenCalledWith("session-1", "user-A");
    expect(repo.revokeBySessionId).toHaveBeenCalledTimes(1);
  });

  it("returns false when the session is not the caller's (repo scopes by userId)", async () => {
    const repo = makeRefreshRepo();
    repo.revokeBySessionId.mockResolvedValue(false);
    const revokeSession = revokeSessionUseCase(repo as unknown as IRefreshTokenRepository);

    const result = await revokeSession("attacker", "victim-session");

    expect(result).toBe(false);
    expect(repo.revokeBySessionId).toHaveBeenCalledWith("victim-session", "attacker");
  });
});
