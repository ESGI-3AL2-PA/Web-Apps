import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IUserReaderRepository, UserRecord } from "../repositories/User/user-reader.repository.js";
import { stepUpUseCase } from "./step-up.use-case.js";

/**
 * Suite de tests du cas d'usage de step-up (ré-authentification TOTP forte).
 *
 * Vérifie qu'un code TOTP valide et non rejoué émet un token d'audience "step-up",
 * et que les cas d'échec (pas de TOTP confirmé, code invalide, code rejoué) ne
 * signent rien.
 */

// verifyTotpStep enveloppe otplib ; on le stub pour qu'un code « valide »
// corresponde à un « step » connu.
vi.mock("../services/totp.js", () => ({
  verifyTotpStep: vi.fn(),
}));

// En prod le token de step-up est un vrai JWT RS256 ; on capture l'audience avec
// laquelle il est signé sans toucher à une vraie paire de clés.
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

  // Un code valide non consommé émet un token de step-up d'audience "step-up".
  it("a valid unused code mints a step-up token with audience 'step-up'", async () => {
    const userReader = makeUserReader(makeUser());
    const result = await stepUpUseCase(userReader as unknown as IUserReaderRepository)("user-1", "123456");

    expect(result).toEqual({ kind: "ok", stepUpToken: "fake.step-up.token" });
    expect(signedAudience).toBe("step-up");
    expect(userReader.consumeTotpStep).toHaveBeenCalledWith("user-1", 4242);
  });

  // Rejette quand l'utilisateur n'a pas de TOTP confirmé.
  it("rejects when the user has no confirmed TOTP", async () => {
    const userReader = makeUserReader(makeUser({ totpEnabled: false, totpSecret: null }));
    const result = await stepUpUseCase(userReader as unknown as IUserReaderRepository)("user-1", "123456");

    expect(result).toEqual({ kind: "not-enabled" });
    expect(verifyTotpStepMock).not.toHaveBeenCalled();
  });

  // Rejette un code invalide et n'émet rien.
  it("rejects an invalid code and mints nothing", async () => {
    verifyTotpStepMock.mockReturnValue(null);
    const userReader = makeUserReader(makeUser());
    const result = await stepUpUseCase(userReader as unknown as IUserReaderRepository)("user-1", "000000");

    expect(result).toEqual({ kind: "invalid-code" });
    expect(userReader.consumeTotpStep).not.toHaveBeenCalled();
    expect(signMock).not.toHaveBeenCalled();
  });

  // Rejette un code rejoué (step déjà consommé) même s'il se vérifie.
  it("rejects a replayed code (step already consumed) even though it verifies", async () => {
    const userReader = makeUserReader(makeUser());
    userReader.consumeTotpStep.mockResolvedValue(false);
    const result = await stepUpUseCase(userReader as unknown as IUserReaderRepository)("user-1", "123456");

    expect(result).toEqual({ kind: "invalid-code" });
    expect(signMock).not.toHaveBeenCalled();
  });
});
