import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IDistrictAdminReaderRepository } from "../repositories/DistrictAdmin/district-admin-reader.repository.js";
import type { IRefreshTokenRepository } from "../repositories/RefreshToken/refresh-token.repository.js";
import type { IUserReaderRepository, UserRecord } from "../repositories/User/user-reader.repository.js";
import { loginMfaUseCase } from "./login-mfa.use-case.js";

// The MFA token is a real RS256 JWT in prod; here we drive jwtVerify's outcome
// directly so we exercise the code path, not jose's crypto.
vi.mock("jose", () => ({
  jwtVerify: vi.fn(),
}));

// verifyTotpStep wraps otplib; stub it so a "valid" code maps to a known step
// and an "invalid" one to null without computing real HOTP counters.
vi.mock("../services/totp.js", () => ({
  verifyTotpStep: vi.fn(),
}));

vi.mock("./issue-tokens.js", () => ({
  issueTokensForUser: vi.fn().mockResolvedValue({
    accessToken: "fake.access.token",
    refreshToken: "fake-refresh-token",
    user: { id: "user-1", adminDistrictId: null },
  }),
}));

import { jwtVerify } from "jose";
import { verifyTotpStep } from "../services/totp.js";
import { issueTokensForUser } from "./issue-tokens.js";

const jwtVerifyMock = vi.mocked(jwtVerify);
const verifyTotpStepMock = vi.mocked(verifyTotpStep);
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
const districtAdminReader = {
  findDistrictIdByUserId: vi.fn().mockResolvedValue(null),
} as unknown as IDistrictAdminReaderRepository;

const validPayload = { payload: { sub: "user-1" } } as unknown as Awaited<ReturnType<typeof jwtVerify>>;

describe("loginMfaUseCase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    jwtVerifyMock.mockResolvedValue(validPayload);
    verifyTotpStepMock.mockReturnValue(12345);
  });

  it("valid MFA token + valid unused code mints tokens", async () => {
    const userReader = makeUserReader(makeUser());
    const loginMfa = loginMfaUseCase(userReader as unknown as IUserReaderRepository, refreshRepo, districtAdminReader);

    const context = { userAgent: "test-agent", ip: "127.0.0.1" };
    const result = await loginMfa("mfa.jwt", "123456", context);

    expect(result.kind).toBe("ok");
    // The consumed step is the one verifyTotpStep resolved the code to.
    expect(userReader.consumeTotpStep).toHaveBeenCalledWith("user-1", 12345);
    expect(issueTokens).toHaveBeenCalledWith(
      expect.objectContaining({ id: "user-1" }),
      refreshRepo,
      districtAdminReader,
      context,
    );
  });

  it("an unverifiable MFA token is rejected without looking the user up", async () => {
    jwtVerifyMock.mockRejectedValue(new Error("bad signature"));
    const userReader = makeUserReader(makeUser());
    const loginMfa = loginMfaUseCase(userReader as unknown as IUserReaderRepository, refreshRepo, districtAdminReader);

    const result = await loginMfa("tampered.jwt", "123456");

    expect(result).toEqual({ kind: "invalid-mfa-token" });
    expect(userReader.findById).not.toHaveBeenCalled();
    expect(issueTokens).not.toHaveBeenCalled();
  });

  it("a token with no subject is rejected as invalid-mfa-token", async () => {
    jwtVerifyMock.mockResolvedValue({ payload: {} } as unknown as Awaited<ReturnType<typeof jwtVerify>>);
    const userReader = makeUserReader(makeUser());
    const loginMfa = loginMfaUseCase(userReader as unknown as IUserReaderRepository, refreshRepo, districtAdminReader);

    const result = await loginMfa("subless.jwt", "123456");

    expect(result).toEqual({ kind: "invalid-mfa-token" });
  });

  it("returns user-not-found when the subject no longer exists", async () => {
    const userReader = makeUserReader(null);
    const loginMfa = loginMfaUseCase(userReader as unknown as IUserReaderRepository, refreshRepo, districtAdminReader);

    const result = await loginMfa("mfa.jwt", "123456");

    expect(result).toEqual({ kind: "user-not-found" });
    expect(issueTokens).not.toHaveBeenCalled();
  });

  it("returns totp-not-enabled when the user has no confirmed enrollment", async () => {
    const userReader = makeUserReader(makeUser({ totpEnabled: false, totpSecret: null }));
    const loginMfa = loginMfaUseCase(userReader as unknown as IUserReaderRepository, refreshRepo, districtAdminReader);

    const result = await loginMfa("mfa.jwt", "123456");

    expect(result).toEqual({ kind: "totp-not-enabled" });
    expect(verifyTotpStepMock).not.toHaveBeenCalled();
  });

  it("an invalid code is rejected and mints nothing", async () => {
    verifyTotpStepMock.mockReturnValue(null);
    const userReader = makeUserReader(makeUser());
    const loginMfa = loginMfaUseCase(userReader as unknown as IUserReaderRepository, refreshRepo, districtAdminReader);

    const result = await loginMfa("mfa.jwt", "000000");

    expect(result).toEqual({ kind: "invalid-code" });
    expect(userReader.consumeTotpStep).not.toHaveBeenCalled();
    expect(issueTokens).not.toHaveBeenCalled();
  });

  it("a replayed code (step already consumed) is rejected even though it verifies", async () => {
    const userReader = makeUserReader(makeUser());
    userReader.consumeTotpStep.mockResolvedValue(false);
    const loginMfa = loginMfaUseCase(userReader as unknown as IUserReaderRepository, refreshRepo, districtAdminReader);

    const result = await loginMfa("mfa.jwt", "123456");

    expect(result).toEqual({ kind: "invalid-code" });
    expect(userReader.consumeTotpStep).toHaveBeenCalledWith("user-1", 12345);
    expect(issueTokens).not.toHaveBeenCalled();
  });
});
