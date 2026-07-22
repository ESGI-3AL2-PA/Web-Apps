import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IDistrictAdminReaderRepository } from "../repositories/DistrictAdmin/district-admin-reader.repository.js";
import type { IRefreshTokenRepository } from "../repositories/RefreshToken/refresh-token.repository.js";
import type { IUserReaderRepository, UserRecord } from "../repositories/User/user-reader.repository.js";
import { loginEnrollConfirmUseCase } from "./login-enroll-confirm.use-case.js";

// Drive jwtVerify's outcome directly — exercise the ceremony, not jose's crypto.
vi.mock("jose", () => ({ jwtVerify: vi.fn() }));

// confirmTotpUseCase is unit-tested on its own; here we stub its verdict so we test
// the ceremony's branching (invalid token / invalid code / token issuance).
const confirmMock = vi.fn();
vi.mock("./confirm-totp.use-case.js", () => ({
  confirmTotpUseCase: () => confirmMock,
}));

vi.mock("./issue-tokens.js", () => ({
  issueTokensForUser: vi.fn().mockResolvedValue({
    accessToken: "fake.access.token",
    refreshToken: "fake-refresh-token",
    user: { id: "user-1", adminDistrictId: null },
  }),
}));

vi.mock("../keys.js", () => ({ getPublicKey: vi.fn(() => "fake-key") }));

import { jwtVerify } from "jose";
import { issueTokensForUser } from "./issue-tokens.js";

const jwtVerifyMock = vi.mocked(jwtVerify);
const issueTokens = vi.mocked(issueTokensForUser);

const makeUser = (over: Partial<UserRecord> = {}): UserRecord => ({
  id: "user-1",
  email: "user@example.com",
  passwordHash: "stored-hash",
  firstName: "Test",
  lastName: "User",
  role: "user",
  address: "1 rue de Test",
  districtId: "district-1",
  balance: 0,
  banned: false,
  emailVerified: true,
  totpSecret: "SECRET",
  totpEnabled: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...over,
});

type UserReaderMock = { [K in keyof IUserReaderRepository]: ReturnType<typeof vi.fn> };
const makeUserReader = (user: UserRecord | null): UserReaderMock => ({
  findByEmail: vi.fn().mockResolvedValue(null),
  findById: vi.fn().mockResolvedValue(user),
  setEmailVerified: vi.fn().mockResolvedValue(undefined),
  setPasswordHash: vi.fn().mockResolvedValue(undefined),
  setTotpSecret: vi.fn().mockResolvedValue(undefined),
  consumeTotpStep: vi.fn().mockResolvedValue(true),
});

const refreshRepo = {} as unknown as IRefreshTokenRepository;
const districtAdminReader = { findDistrictIdByUserId: vi.fn() } as unknown as IDistrictAdminReaderRepository;
const validPayload = { payload: { sub: "user-1" } } as unknown as Awaited<ReturnType<typeof jwtVerify>>;

describe("loginEnrollConfirmUseCase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    jwtVerifyMock.mockResolvedValue(validPayload);
    confirmMock.mockResolvedValue("ok");
  });

  it("a valid enroll token + code confirms and issues the real tokens", async () => {
    const userReader = makeUserReader(makeUser());
    const confirm = loginEnrollConfirmUseCase(
      userReader as unknown as IUserReaderRepository,
      refreshRepo,
      districtAdminReader,
    );

    const context = { userAgent: "test-agent", ip: "127.0.0.1" };
    const result = await confirm("enroll.jwt", "123456", context);

    expect(result.kind).toBe("ok");
    expect(confirmMock).toHaveBeenCalledWith("user-1", "123456");
    expect(issueTokens).toHaveBeenCalledWith(
      expect.objectContaining({ id: "user-1" }),
      refreshRepo,
      districtAdminReader,
      context,
    );
  });

  it("an unverifiable enroll token is rejected without confirming or issuing", async () => {
    jwtVerifyMock.mockRejectedValue(new Error("bad token"));
    const userReader = makeUserReader(makeUser());
    const confirm = loginEnrollConfirmUseCase(
      userReader as unknown as IUserReaderRepository,
      refreshRepo,
      districtAdminReader,
    );

    const result = await confirm("tampered.jwt", "123456");

    expect(result).toEqual({ kind: "invalid-token" });
    expect(confirmMock).not.toHaveBeenCalled();
    expect(issueTokens).not.toHaveBeenCalled();
  });

  it("an invalid code surfaces invalid-code and issues nothing", async () => {
    confirmMock.mockResolvedValue("invalid-code");
    const userReader = makeUserReader(makeUser());
    const confirm = loginEnrollConfirmUseCase(
      userReader as unknown as IUserReaderRepository,
      refreshRepo,
      districtAdminReader,
    );

    const result = await confirm("enroll.jwt", "000000");

    expect(result).toEqual({ kind: "invalid-code" });
    expect(issueTokens).not.toHaveBeenCalled();
  });
});
