// Suite de tests : second facteur du login (login-mfa). Couvre ticket invalide,
// utilisateur absent, TOTP non activé, code invalide et rejeu, jusqu'au cas nominal.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IDistrictAdminReaderRepository } from "../repositories/DistrictAdmin/district-admin-reader.repository.js";
import type { IRefreshTokenRepository } from "../repositories/RefreshToken/refresh-token.repository.js";
import type { IUserReaderRepository, UserRecord } from "../repositories/User/user-reader.repository.js";
import { loginMfaUseCase } from "./login-mfa.use-case.js";

// Le ticket MFA est un vrai JWT RS256 en prod ; ici on pilote directement le résultat
// de jwtVerify pour tester le chemin de code, pas la crypto de jose.
vi.mock("jose", () => ({
  jwtVerify: vi.fn(),
}));

// verifyTotpStep enveloppe otplib ; on le stubbe pour qu'un code « valide » corresponde à un
// pas connu et un code « invalide » à null, sans calculer de vrais compteurs HOTP.
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
    // Par défaut : ticket valide et code résolu au pas 12345 ; chaque test surcharge au besoin.
    vi.clearAllMocks();
    jwtVerifyMock.mockResolvedValue(validPayload);
    verifyTotpStepMock.mockReturnValue(12345);
  });

  // Cas nominal : ticket valide + code valide non encore consommé → émission des tokens.
  it("valid MFA token + valid unused code mints tokens", async () => {
    const userReader = makeUserReader(makeUser());
    const loginMfa = loginMfaUseCase(userReader as unknown as IUserReaderRepository, refreshRepo, districtAdminReader);

    const context = { userAgent: "test-agent", ip: "127.0.0.1" };
    const result = await loginMfa("mfa.jwt", "123456", context);

    expect(result.kind).toBe("ok");
    // Le pas consommé est celui auquel verifyTotpStep a résolu le code.
    expect(userReader.consumeTotpStep).toHaveBeenCalledWith("user-1", 12345);
    expect(issueTokens).toHaveBeenCalledWith(
      expect.objectContaining({ id: "user-1" }),
      refreshRepo,
      districtAdminReader,
      context,
    );
  });

  // Ticket non vérifiable → invalid-mfa-token, sans même chercher l'utilisateur.
  it("an unverifiable MFA token is rejected without looking the user up", async () => {
    jwtVerifyMock.mockRejectedValue(new Error("bad signature"));
    const userReader = makeUserReader(makeUser());
    const loginMfa = loginMfaUseCase(userReader as unknown as IUserReaderRepository, refreshRepo, districtAdminReader);

    const result = await loginMfa("tampered.jwt", "123456");

    expect(result).toEqual({ kind: "invalid-mfa-token" });
    expect(userReader.findById).not.toHaveBeenCalled();
    expect(issueTokens).not.toHaveBeenCalled();
  });

  // Ticket sans sujet (sub) → invalid-mfa-token.
  it("a token with no subject is rejected as invalid-mfa-token", async () => {
    jwtVerifyMock.mockResolvedValue({ payload: {} } as unknown as Awaited<ReturnType<typeof jwtVerify>>);
    const userReader = makeUserReader(makeUser());
    const loginMfa = loginMfaUseCase(userReader as unknown as IUserReaderRepository, refreshRepo, districtAdminReader);

    const result = await loginMfa("subless.jwt", "123456");

    expect(result).toEqual({ kind: "invalid-mfa-token" });
  });

  // Sujet du ticket introuvable (utilisateur supprimé) → user-not-found.
  it("returns user-not-found when the subject no longer exists", async () => {
    const userReader = makeUserReader(null);
    const loginMfa = loginMfaUseCase(userReader as unknown as IUserReaderRepository, refreshRepo, districtAdminReader);

    const result = await loginMfa("mfa.jwt", "123456");

    expect(result).toEqual({ kind: "user-not-found" });
    expect(issueTokens).not.toHaveBeenCalled();
  });

  // Utilisateur sans enrôlement TOTP confirmé → totp-not-enabled, sans vérifier de code.
  it("returns totp-not-enabled when the user has no confirmed enrollment", async () => {
    const userReader = makeUserReader(makeUser({ totpEnabled: false, totpSecret: null }));
    const loginMfa = loginMfaUseCase(userReader as unknown as IUserReaderRepository, refreshRepo, districtAdminReader);

    const result = await loginMfa("mfa.jwt", "123456");

    expect(result).toEqual({ kind: "totp-not-enabled" });
    expect(verifyTotpStepMock).not.toHaveBeenCalled();
  });

  // Code hors fenêtre (verifyTotpStep → null) → invalid-code, sans consommer de pas ni émettre.
  it("an invalid code is rejected and mints nothing", async () => {
    verifyTotpStepMock.mockReturnValue(null);
    const userReader = makeUserReader(makeUser());
    const loginMfa = loginMfaUseCase(userReader as unknown as IUserReaderRepository, refreshRepo, districtAdminReader);

    const result = await loginMfa("mfa.jwt", "000000");

    expect(result).toEqual({ kind: "invalid-code" });
    expect(userReader.consumeTotpStep).not.toHaveBeenCalled();
    expect(issueTokens).not.toHaveBeenCalled();
  });

  // Rejeu : code valide mais pas déjà consommé (consumeTotpStep → false) → invalid-code.
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
