import { describe, expect, it, vi } from "vitest";
import type { IRefreshTokenRepository } from "../repositories/RefreshToken/refresh-token.repository.js";
import { revokeSessionUseCase } from "./revoke-session.use-case.js";

/**
 * Suite de tests du cas d'usage de révocation de session.
 *
 * Vérifie surtout la garde IDOR : l'userId de l'appelant doit toujours être
 * transmis au repo pour cadrer la révocation, et une session qui n'appartient pas
 * à l'appelant renvoie false.
 */

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
  listAllForUser: vi.fn().mockResolvedValue([]),
  backfillMissingExpiresAtDate: vi.fn().mockResolvedValue(0),
});

describe("revokeSessionUseCase", () => {
  // Transmet À LA FOIS sessionId et l'userId de l'appelant pour cadrer la révocation (garde IDOR).
  it("forwards BOTH sessionId and the caller's userId to scope the revoke (IDOR guard)", async () => {
    const repo = makeRefreshRepo();
    const revokeSession = revokeSessionUseCase(repo as unknown as IRefreshTokenRepository);

    const result = await revokeSession("user-A", "session-1");

    expect(result).toBe(true);
    // L'userId DOIT être transmis — l'omettre laisserait un utilisateur révoquer la session d'un autre.
    expect(repo.revokeBySessionId).toHaveBeenCalledWith("session-1", "user-A");
    expect(repo.revokeBySessionId).toHaveBeenCalledTimes(1);
  });

  // Renvoie false quand la session n'appartient pas à l'appelant (le repo cadre par userId).
  it("returns false when the session is not the caller's (repo scopes by userId)", async () => {
    const repo = makeRefreshRepo();
    repo.revokeBySessionId.mockResolvedValue(false);
    const revokeSession = revokeSessionUseCase(repo as unknown as IRefreshTokenRepository);

    const result = await revokeSession("attacker", "victim-session");

    expect(result).toBe(false);
    expect(repo.revokeBySessionId).toHaveBeenCalledWith("victim-session", "attacker");
  });
});
