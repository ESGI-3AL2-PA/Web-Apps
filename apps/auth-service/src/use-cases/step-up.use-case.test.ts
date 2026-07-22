import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IUserReaderRepository, UserRecord } from "../repositories/User/user-reader.repository.js";
import { stepUpUseCase } from "./step-up.use-case.js";

// verifyTotpStep wraps otplib; stub it so a "valid" code maps to a known step.
vi.mock("../services/totp.js", () => ({
  verifyTotpStep: vi.fn(),
}));

// The step-up token is a real RS256 JWT in prod; capture the audience it is signed with
// without touching a real key pair.
const signMock = vi.fn().mockResolvedValue("fake.step-up.token");
let signedAudience: string | null = null;
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
    setAudience(aud: string) {
      signedAudience = aud;
      return this;
    }
    setIssuedAt() {
      return this;
    }
    setExpirationTime() {
      return this;
    }
    sign() {
      return signMock();
    }
  }
  return { SignJWT };
});

vi.mock("../keys.js", () => ({
  getPrivateKey: vi.fn(() => "fake-key"),
  getKeyId: vi.fn(() => "test-kid"),
}));

import { verifyTotpStep } from "../services/totp.js";
const verifyTotpStepMock = vi.mocked(verifyTotpStep);

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

describe("stepUpUseCase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signedAudience = null;
    verifyTotpStepMock.mockReturnValue(4242);
  });

  it("a valid unused code mints a step-up token with audience 'step-up'", async () => {
    const userReader = makeUserReader(makeUser());
    const result = await stepUpUseCase(userReader as unknown as IUserReaderRepository)("user-1", "123456");

    expect(result).toEqual({ kind: "ok", stepUpToken: "fake.step-up.token" });
    expect(signedAudience).toBe("step-up");
    expect(userReader.consumeTotpStep).toHaveBeenCalledWith("user-1", 4242);
  });

  it("rejects when the user has no confirmed TOTP", async () => {
    const userReader = makeUserReader(makeUser({ totpEnabled: false, totpSecret: null }));
    const result = await stepUpUseCase(userReader as unknown as IUserReaderRepository)("user-1", "123456");

    expect(result).toEqual({ kind: "not-enabled" });
    expect(verifyTotpStepMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid code and mints nothing", async () => {
    verifyTotpStepMock.mockReturnValue(null);
    const userReader = makeUserReader(makeUser());
    const result = await stepUpUseCase(userReader as unknown as IUserReaderRepository)("user-1", "000000");

    expect(result).toEqual({ kind: "invalid-code" });
    expect(userReader.consumeTotpStep).not.toHaveBeenCalled();
    expect(signMock).not.toHaveBeenCalled();
  });

  it("rejects a replayed code (step already consumed) even though it verifies", async () => {
    const userReader = makeUserReader(makeUser());
    userReader.consumeTotpStep.mockResolvedValue(false);
    const result = await stepUpUseCase(userReader as unknown as IUserReaderRepository)("user-1", "123456");

    expect(result).toEqual({ kind: "invalid-code" });
    expect(signMock).not.toHaveBeenCalled();
  });
});
