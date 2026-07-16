import { createHash } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthToken } from "../entities/auth-token.entity.js";
import type { IAuthTokenRepository } from "../repositories/AuthToken/auth-token.repository.js";
import type { IRefreshTokenRepository } from "../repositories/RefreshToken/refresh-token.repository.js";
import type { IUserReaderRepository, UserRecord } from "../repositories/User/user-reader.repository.js";
import { resetPasswordUseCase } from "./reset-password.use-case.js";

// Real argon2 hashing is slow and irrelevant here; assert setPasswordHash is
// called with the derived hash, not the hash's contents.
vi.mock("argon2", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("new-password-hash"),
  },
}));

const RAW_TOKEN = "raw-reset-token";
const TOKEN_HASH = createHash("sha256").update(RAW_TOKEN).digest("hex");

const futureIso = new Date(Date.now() + 60 * 60 * 1000).toISOString();
const pastIso = new Date(Date.now() - 60 * 60 * 1000).toISOString();

const makeRecord = (over: Partial<AuthToken> = {}): AuthToken => ({
  id: "token-1",
  userId: "user-1",
  tokenHash: TOKEN_HASH,
  type: "reset_password",
  expiresAt: futureIso,
  usedAt: null,
  createdAt: new Date().toISOString(),
  ...over,
});

const makeUser = (over: Partial<UserRecord> = {}): UserRecord => ({
  id: "user-1",
  email: "user@example.com",
  passwordHash: "old-hash",
  firstName: "Test",
  lastName: "User",
  role: "user",
  address: "1 rue de Test",
  districtId: "district-1",
  balance: 0,
  banned: false,
  emailVerified: true,
  totpSecret: null,
  totpEnabled: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...over,
});

type AuthTokenRepoMock = { [K in keyof IAuthTokenRepository]: ReturnType<typeof vi.fn> };
type UserReaderMock = { [K in keyof IUserReaderRepository]: ReturnType<typeof vi.fn> };
type RefreshRepoMock = { [K in keyof IRefreshTokenRepository]: ReturnType<typeof vi.fn> };

const makeAuthTokenRepo = (record: AuthToken | null): AuthTokenRepoMock => ({
  create: vi.fn(),
  findActiveByHash: vi.fn().mockResolvedValue(record),
  markUsed: vi.fn().mockResolvedValue(undefined),
  revokeAllForUser: vi.fn().mockResolvedValue(undefined),
});

const makeUserReader = (user: UserRecord | null): UserReaderMock => ({
  findByEmail: vi.fn().mockResolvedValue(null),
  findById: vi.fn().mockResolvedValue(user),
  setEmailVerified: vi.fn().mockResolvedValue(undefined),
  setPasswordHash: vi.fn().mockResolvedValue(undefined),
  setTotpSecret: vi.fn().mockResolvedValue(undefined),
  consumeTotpStep: vi.fn().mockResolvedValue(true),
});

const makeRefreshRepo = (): RefreshRepoMock => ({
  create: vi.fn(),
  findActiveByTokenHash: vi.fn(),
  claimByTokenHash: vi.fn(),
  findByTokenHash: vi.fn(),
  findActiveByUserId: vi.fn(),
  revokeByTokenHash: vi.fn(),
  revokeById: vi.fn(),
  revokeBySessionId: vi.fn(),
  revokeAllForUser: vi.fn().mockResolvedValue(undefined),
  deleteAllForUser: vi.fn(),
  listAllForUser: vi.fn().mockResolvedValue([]),
  backfillMissingExpiresAtDate: vi.fn().mockResolvedValue(0),
});

describe("resetPasswordUseCase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("a valid token updates the password, consumes the token, and logs out other sessions", async () => {
    const authTokenRepo = makeAuthTokenRepo(makeRecord());
    const userReader = makeUserReader(makeUser());
    const refreshRepo = makeRefreshRepo();
    const reset = resetPasswordUseCase(
      authTokenRepo as unknown as IAuthTokenRepository,
      userReader as unknown as IUserReaderRepository,
      refreshRepo as unknown as IRefreshTokenRepository,
    );

    const result = await reset(RAW_TOKEN, "new-password");

    expect(result).toBe("ok");
    // Token is looked up by its sha256 hash, scoped to the reset_password type.
    expect(authTokenRepo.findActiveByHash).toHaveBeenCalledWith(TOKEN_HASH, "reset_password");
    expect(userReader.setPasswordHash).toHaveBeenCalledWith("user-1", "new-password-hash");
    // Single-use: the token is burned.
    expect(authTokenRepo.markUsed).toHaveBeenCalledWith("token-1");
    // Every existing session is invalidated after a password change.
    expect(refreshRepo.revokeAllForUser).toHaveBeenCalledWith("user-1");
  });

  it("an unknown/reused token is rejected as invalid without touching the password", async () => {
    const authTokenRepo = makeAuthTokenRepo(null);
    const userReader = makeUserReader(makeUser());
    const refreshRepo = makeRefreshRepo();
    const reset = resetPasswordUseCase(
      authTokenRepo as unknown as IAuthTokenRepository,
      userReader as unknown as IUserReaderRepository,
      refreshRepo as unknown as IRefreshTokenRepository,
    );

    const result = await reset(RAW_TOKEN, "new-password");

    expect(result).toBe("invalid");
    expect(userReader.setPasswordHash).not.toHaveBeenCalled();
    expect(authTokenRepo.markUsed).not.toHaveBeenCalled();
  });

  it("an expired token is burned and rejected, leaving the password unchanged", async () => {
    const authTokenRepo = makeAuthTokenRepo(makeRecord({ expiresAt: pastIso }));
    const userReader = makeUserReader(makeUser());
    const refreshRepo = makeRefreshRepo();
    const reset = resetPasswordUseCase(
      authTokenRepo as unknown as IAuthTokenRepository,
      userReader as unknown as IUserReaderRepository,
      refreshRepo as unknown as IRefreshTokenRepository,
    );

    const result = await reset(RAW_TOKEN, "new-password");

    expect(result).toBe("expired");
    // Even expired, the row is marked used so it can't be retried.
    expect(authTokenRepo.markUsed).toHaveBeenCalledWith("token-1");
    expect(userReader.setPasswordHash).not.toHaveBeenCalled();
    expect(refreshRepo.revokeAllForUser).not.toHaveBeenCalled();
  });

  it("returns user-not-found when the token references a deleted account", async () => {
    const authTokenRepo = makeAuthTokenRepo(makeRecord());
    const userReader = makeUserReader(null);
    const refreshRepo = makeRefreshRepo();
    const reset = resetPasswordUseCase(
      authTokenRepo as unknown as IAuthTokenRepository,
      userReader as unknown as IUserReaderRepository,
      refreshRepo as unknown as IRefreshTokenRepository,
    );

    const result = await reset(RAW_TOKEN, "new-password");

    expect(result).toBe("user-not-found");
    expect(userReader.setPasswordHash).not.toHaveBeenCalled();
    expect(authTokenRepo.markUsed).not.toHaveBeenCalled();
  });
});
