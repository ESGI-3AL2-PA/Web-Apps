import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IDistrictAdminReaderRepository } from "../repositories/DistrictAdmin/district-admin-reader.repository.js";
import type { IRefreshTokenRepository } from "../repositories/RefreshToken/refresh-token.repository.js";
import type { IUserReaderRepository, UserRecord } from "../repositories/User/user-reader.repository.js";
import { loginUseCase } from "./login.use-case.js";

// argon2 is verified against a real hash in prod; here we only care about the
// control flow, so stub verify/hash and drive the return value per test.
vi.mock("argon2", () => ({
  default: {
    verify: vi.fn().mockResolvedValue(true),
    hash: vi.fn().mockResolvedValue("dummy-hash"),
  },
}));

// The token minting is unit-tested via issue-tokens elsewhere; stub it so login
// never touches a real RS256 key on the happy path.
vi.mock("./issue-tokens.js", () => ({
  issueTokensForUser: vi.fn().mockResolvedValue({
    accessToken: "fake.access.token",
    refreshToken: "fake-refresh-token",
    user: { id: "user-1", adminDistrictId: null },
  }),
}));

// login signs the short-lived MFA token itself via jose; stub SignJWT so the
// mfa-required branch doesn't need an initialised key pair.
vi.mock("jose", () => {
  class SignJWT {
    setProtectedHeader() {
      return this;
    }
    setSubject() {
      return this;
    }
    setIssuer() {
      return this;
    }
    setAudience() {
      return this;
    }
    setIssuedAt() {
      return this;
    }
    setExpirationTime() {
      return this;
    }
    sign() {
      return Promise.resolve("fake.mfa.token");
    }
  }
  return { SignJWT };
});

vi.mock("../keys.js", () => ({
  getPrivateKey: vi.fn(() => "fake-key"),
}));

import argon2 from "argon2";
import { issueTokensForUser } from "./issue-tokens.js";

const argon2Verify = vi.mocked(argon2.verify);
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
  totpSecret: null,
  totpEnabled: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...over,
});

type UserReaderMock = { [K in keyof IUserReaderRepository]: ReturnType<typeof vi.fn> };

const makeUserReader = (user: UserRecord | null): UserReaderMock => ({
  findByEmail: vi.fn().mockResolvedValue(user),
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

const CREDS = { email: "user@example.com", password: "correct-horse" };

describe("loginUseCase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    argon2Verify.mockResolvedValue(true as never);
  });

  it("correct password mints tokens and forwards the session context", async () => {
    const userReader = makeUserReader(makeUser());
    const login = loginUseCase(userReader as unknown as IUserReaderRepository, refreshRepo, districtAdminReader);

    const context = { userAgent: "test-agent", ip: "127.0.0.1" };
    const result = await login(CREDS, context);

    expect(result.kind).toBe("ok");
    expect(argon2Verify).toHaveBeenCalledWith("stored-hash", CREDS.password);
    expect(issueTokens).toHaveBeenCalledWith(
      expect.objectContaining({ id: "user-1" }),
      refreshRepo,
      districtAdminReader,
      context,
    );
  });

  it("wrong password is rejected as invalid-credentials and mints nothing", async () => {
    argon2Verify.mockResolvedValue(false as never);
    const userReader = makeUserReader(makeUser());
    const login = loginUseCase(userReader as unknown as IUserReaderRepository, refreshRepo, districtAdminReader);

    const result = await login(CREDS);

    expect(result).toEqual({ kind: "invalid-credentials" });
    expect(issueTokens).not.toHaveBeenCalled();
  });

  it("unknown email returns generic invalid-credentials AND still runs a verify (no user enumeration)", async () => {
    const userReader = makeUserReader(null);
    const login = loginUseCase(userReader as unknown as IUserReaderRepository, refreshRepo, districtAdminReader);

    const result = await login(CREDS);

    expect(result).toEqual({ kind: "invalid-credentials" });
    // A dummy verify runs to equalise timing whether or not the account exists.
    expect(argon2Verify).toHaveBeenCalledWith("dummy-hash", CREDS.password);
    expect(issueTokens).not.toHaveBeenCalled();
  });

  it("banned user is rejected even with a correct password", async () => {
    const userReader = makeUserReader(makeUser({ banned: true }));
    const login = loginUseCase(userReader as unknown as IUserReaderRepository, refreshRepo, districtAdminReader);

    const result = await login(CREDS);

    expect(result).toEqual({ kind: "banned" });
    expect(issueTokens).not.toHaveBeenCalled();
  });

  it("unverified email is rejected with email-not-verified", async () => {
    const userReader = makeUserReader(makeUser({ emailVerified: false }));
    const login = loginUseCase(userReader as unknown as IUserReaderRepository, refreshRepo, districtAdminReader);

    const result = await login(CREDS);

    expect(result).toEqual({ kind: "email-not-verified" });
    expect(issueTokens).not.toHaveBeenCalled();
  });

  it("a TOTP-enrolled user is challenged (mfa-required) instead of receiving tokens", async () => {
    const userReader = makeUserReader(makeUser({ totpEnabled: true, totpSecret: "SECRET" }));
    const login = loginUseCase(userReader as unknown as IUserReaderRepository, refreshRepo, districtAdminReader);

    const result = await login(CREDS);

    expect(result.kind).toBe("mfa-required");
    if (result.kind === "mfa-required") expect(result.mfaToken).toBe("fake.mfa.token");
    // No full session is issued until the second factor is proven.
    expect(issueTokens).not.toHaveBeenCalled();
  });
});
