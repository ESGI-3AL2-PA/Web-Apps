import { createHash } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RefreshToken } from "../entities/refresh-token.entity.js";
import type { IRefreshTokenRepository } from "../repositories/RefreshToken/refresh-token.repository.js";
import type { IDistrictAdminReaderRepository } from "../repositories/DistrictAdmin/district-admin-reader.repository.js";
import type { IUserReaderRepository, UserRecord } from "../repositories/User/user-reader.repository.js";
import { refreshUseCase } from "./refresh.use-case.js";

// Mock the token signer / key provider so the use-case never touches a real RS256 key.
// signAccessToken/lookupAdminDistrictId are unit-tested elsewhere; here we only care
// about the rotation + reuse-detection logic around them.
vi.mock("./issue-tokens.js", () => ({
  signAccessToken: vi.fn().mockResolvedValue("fake.access.token"),
  lookupAdminDistrictId: vi.fn().mockResolvedValue(null),
}));

const RAW_TOKEN = "raw-refresh-token";
const TOKEN_HASH = createHash("sha256").update(RAW_TOKEN).digest("hex");

const futureIso = new Date(Date.now() + 60 * 60 * 1000).toISOString();
const pastIso = new Date(Date.now() - 60 * 60 * 1000).toISOString();

const makeStoredToken = (over: Partial<RefreshToken> = {}): RefreshToken => ({
  id: "token-1",
  userId: "user-1",
  tokenHash: TOKEN_HASH,
  expiresAt: futureIso,
  expiresAtDate: new Date(futureIso),
  revokedAt: null,
  createdAt: new Date().toISOString(),
  sessionId: "session-1",
  userAgent: "test-agent",
  ip: "127.0.0.1",
  lastUsedAt: null,
  ...over,
});

const makeUser = (over: Partial<UserRecord> = {}): UserRecord => ({
  id: "user-1",
  email: "user@example.com",
  passwordHash: "hash",
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

type RefreshRepoMock = {
  [K in keyof IRefreshTokenRepository]: ReturnType<typeof vi.fn>;
};

const makeRefreshRepo = (): RefreshRepoMock => ({
  create: vi.fn(async (data: Omit<RefreshToken, "id">) => ({ id: "new-token", ...data })),
  findActiveByTokenHash: vi.fn().mockResolvedValue(null),
  claimByTokenHash: vi.fn().mockResolvedValue(null),
  findByTokenHash: vi.fn().mockResolvedValue(null),
  findActiveByUserId: vi.fn().mockResolvedValue([]),
  revokeByTokenHash: vi.fn().mockResolvedValue(true),
  revokeById: vi.fn().mockResolvedValue(true),
  revokeBySessionId: vi.fn().mockResolvedValue(true),
  revokeAllForUser: vi.fn().mockResolvedValue(undefined),
  deleteAllForUser: vi.fn().mockResolvedValue(undefined),
  listAllForUser: vi.fn().mockResolvedValue([]),
  backfillMissingExpiresAtDate: vi.fn().mockResolvedValue(0),
});

const makeUserReader = (user: UserRecord | null): IUserReaderRepository => ({
  findByEmail: vi.fn().mockResolvedValue(null),
  findById: vi.fn().mockResolvedValue(user),
  setEmailVerified: vi.fn().mockResolvedValue(undefined),
  setPasswordHash: vi.fn().mockResolvedValue(undefined),
  setTotpSecret: vi.fn().mockResolvedValue(undefined),
  consumeTotpStep: vi.fn().mockResolvedValue(true),
});

const districtAdminReader: IDistrictAdminReaderRepository = {
  findDistrictIdByUserId: vi.fn().mockResolvedValue(null),
};

describe("refreshUseCase", () => {
  let repo: RefreshRepoMock;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = makeRefreshRepo();
  });

  it("rotates a valid token: claims the active token and mints a fresh one", async () => {
    const stored = makeStoredToken();
    repo.claimByTokenHash.mockResolvedValue(stored);
    const userReader = makeUserReader(makeUser());

    const refresh = refreshUseCase(repo as unknown as IRefreshTokenRepository, userReader, districtAdminReader);
    const result = await refresh(RAW_TOKEN);

    expect(repo.claimByTokenHash).toHaveBeenCalledWith(TOKEN_HASH);
    expect(result).not.toBeNull();
    expect(result?.accessToken).toBe("fake.access.token");
    expect(result?.refreshToken).toMatch(/^[a-f0-9]{128}$/);
    // rotation persists a new token that preserves the session identity
    expect(repo.create).toHaveBeenCalledTimes(1);
    expect(repo.create.mock.calls[0]![0]).toMatchObject({ sessionId: "session-1", userId: "user-1" });
    // no theft response on the happy path
    expect(repo.revokeBySessionId).not.toHaveBeenCalled();
    expect(repo.revokeAllForUser).not.toHaveBeenCalled();
  });

  it("replay of an already-rotated token revokes ONLY the session family, not the whole user", async () => {
    repo.claimByTokenHash.mockResolvedValue(null); // already claimed → not active
    repo.findByTokenHash.mockResolvedValue(
      makeStoredToken({ revokedAt: new Date().toISOString(), sessionId: "session-9" }),
    );
    const userReader = makeUserReader(makeUser());

    const refresh = refreshUseCase(repo as unknown as IRefreshTokenRepository, userReader, districtAdminReader);
    const result = await refresh(RAW_TOKEN);

    expect(result).toBeNull();
    // family-scoped revoke (internal reuse-detection: no userId argument)
    expect(repo.revokeBySessionId).toHaveBeenCalledWith("session-9");
    expect(repo.revokeAllForUser).not.toHaveBeenCalled();
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("legacy replay (revoked row with no sessionId) falls back to revoking all user sessions", async () => {
    repo.claimByTokenHash.mockResolvedValue(null);
    repo.findByTokenHash.mockResolvedValue(
      makeStoredToken({ revokedAt: new Date().toISOString(), sessionId: null, userId: "user-1" }),
    );
    const userReader = makeUserReader(makeUser());

    const refresh = refreshUseCase(repo as unknown as IRefreshTokenRepository, userReader, districtAdminReader);
    const result = await refresh(RAW_TOKEN);

    expect(result).toBeNull();
    expect(repo.revokeAllForUser).toHaveBeenCalledWith("user-1");
    expect(repo.revokeBySessionId).not.toHaveBeenCalled();
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("unknown token (never seen) returns null without any revoke", async () => {
    repo.claimByTokenHash.mockResolvedValue(null);
    repo.findByTokenHash.mockResolvedValue(null);
    const userReader = makeUserReader(makeUser());

    const refresh = refreshUseCase(repo as unknown as IRefreshTokenRepository, userReader, districtAdminReader);
    const result = await refresh(RAW_TOKEN);

    expect(result).toBeNull();
    expect(repo.revokeBySessionId).not.toHaveBeenCalled();
    expect(repo.revokeAllForUser).not.toHaveBeenCalled();
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("expired token (claimed but past expiry) returns null and mints nothing", async () => {
    repo.claimByTokenHash.mockResolvedValue(makeStoredToken({ expiresAt: pastIso, expiresAtDate: new Date(pastIso) }));
    const userReader = makeUserReader(makeUser());

    const refresh = refreshUseCase(repo as unknown as IRefreshTokenRepository, userReader, districtAdminReader);
    const result = await refresh(RAW_TOKEN);

    expect(result).toBeNull();
    expect(repo.create).not.toHaveBeenCalled();
    expect(repo.revokeBySessionId).not.toHaveBeenCalled();
    expect(repo.revokeAllForUser).not.toHaveBeenCalled();
  });

  it("banned user revokes all their sessions and refuses to mint a token", async () => {
    repo.claimByTokenHash.mockResolvedValue(makeStoredToken({ userId: "user-1" }));
    const userReader = makeUserReader(makeUser({ banned: true }));

    const refresh = refreshUseCase(repo as unknown as IRefreshTokenRepository, userReader, districtAdminReader);
    const result = await refresh(RAW_TOKEN);

    expect(result).toBeNull();
    expect(repo.revokeAllForUser).toHaveBeenCalledWith("user-1");
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("missing user (deleted mid-session) returns null without minting", async () => {
    repo.claimByTokenHash.mockResolvedValue(makeStoredToken());
    const userReader = makeUserReader(null);

    const refresh = refreshUseCase(repo as unknown as IRefreshTokenRepository, userReader, districtAdminReader);
    const result = await refresh(RAW_TOKEN);

    expect(result).toBeNull();
    expect(repo.create).not.toHaveBeenCalled();
  });
});
