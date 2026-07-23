// Suite de tests : cas d'usage login (étape 1). Vérifie mot de passe correct/incorrect,
// absence d'énumération, bannissement, e-mail non vérifié, et l'aiguillage MFA/enrôlement
// selon que le TOTP est activé et selon NODE_ENV.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IDistrictAdminReaderRepository } from "../repositories/DistrictAdmin/district-admin-reader.repository.js";
import type { IRefreshTokenRepository } from "../repositories/RefreshToken/refresh-token.repository.js";
import type { IUserReaderRepository, UserRecord } from "../repositories/User/user-reader.repository.js";
import { loginUseCase } from "./login.use-case.js";

// argon2 est vérifié contre un vrai hash en prod ; ici seul le flux de contrôle compte,
// donc on stubbe verify/hash et on pilote la valeur de retour par test.
vi.mock("argon2", () => ({
  default: {
    verify: vi.fn().mockResolvedValue(true),
    hash: vi.fn().mockResolvedValue("dummy-hash"),
  },
}));

// L'émission des tokens est testée via issue-tokens ailleurs ; on la stubbe pour que
// login ne touche jamais une vraie clé RS256 sur le chemin nominal.
vi.mock("./issue-tokens.js", () => ({
  issueTokensForUser: vi.fn().mockResolvedValue({
    accessToken: "fake.access.token",
    refreshToken: "fake-refresh-token",
    user: { id: "user-1", adminDistrictId: null },
  }),
}));

// login signe lui-même le ticket MFA court via jose ; on stubbe SignJWT pour que la
// branche mfa-required n'ait pas besoin d'une paire de clés initialisée.
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
  getKeyId: vi.fn(() => "test-kid"),
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

  // Cas nominal : mot de passe correct → émission des tokens et transmission du contexte de session.
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

  // Mauvais mot de passe → invalid-credentials, aucun token émis.
  it("wrong password is rejected as invalid-credentials and mints nothing", async () => {
    argon2Verify.mockResolvedValue(false as never);
    const userReader = makeUserReader(makeUser());
    const login = loginUseCase(userReader as unknown as IUserReaderRepository, refreshRepo, districtAdminReader);

    const result = await login(CREDS);

    expect(result).toEqual({ kind: "invalid-credentials" });
    expect(issueTokens).not.toHaveBeenCalled();
  });

  // E-mail inconnu → invalid-credentials générique, mais un verify factice tourne quand même (anti-énumération).
  it("unknown email returns generic invalid-credentials AND still runs a verify (no user enumeration)", async () => {
    const userReader = makeUserReader(null);
    const login = loginUseCase(userReader as unknown as IUserReaderRepository, refreshRepo, districtAdminReader);

    const result = await login(CREDS);

    expect(result).toEqual({ kind: "invalid-credentials" });
    // Un verify factice tourne pour égaliser le temps de réponse, que le compte existe ou non.
    expect(argon2Verify).toHaveBeenCalledWith("dummy-hash", CREDS.password);
    expect(issueTokens).not.toHaveBeenCalled();
  });

  // Utilisateur banni → rejeté (banned) même avec le bon mot de passe.
  it("banned user is rejected even with a correct password", async () => {
    const userReader = makeUserReader(makeUser({ banned: true }));
    const login = loginUseCase(userReader as unknown as IUserReaderRepository, refreshRepo, districtAdminReader);

    const result = await login(CREDS);

    expect(result).toEqual({ kind: "banned" });
    expect(issueTokens).not.toHaveBeenCalled();
  });

  // E-mail non vérifié → email-not-verified.
  it("unverified email is rejected with email-not-verified", async () => {
    const userReader = makeUserReader(makeUser({ emailVerified: false }));
    const login = loginUseCase(userReader as unknown as IUserReaderRepository, refreshRepo, districtAdminReader);

    const result = await login(CREDS);

    expect(result).toEqual({ kind: "email-not-verified" });
    expect(issueTokens).not.toHaveBeenCalled();
  });

  // Utilisateur avec TOTP activé → défi mfa-required (ticket MFA) au lieu de recevoir des tokens.
  it("a TOTP-enrolled user is challenged (mfa-required) instead of receiving tokens", async () => {
    const userReader = makeUserReader(makeUser({ totpEnabled: true, totpSecret: "SECRET" }));
    const login = loginUseCase(userReader as unknown as IUserReaderRepository, refreshRepo, districtAdminReader);

    const result = await login(CREDS);

    expect(result.kind).toBe("mfa-required");
    if (result.kind === "mfa-required") expect(result.mfaToken).toBe("fake.mfa.token");
    // Aucune session complète n'est émise tant que le second facteur n'est pas prouvé.
    expect(issueTokens).not.toHaveBeenCalled();
  });

  // En production, utilisateur sans TOTP → enrôlement forcé (enrollment-required, ticket enroll), aucun token.
  it("in production a user without TOTP is forced to enroll (enrollment-required), no tokens", async () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const userReader = makeUserReader(makeUser({ totpEnabled: false, totpSecret: null }));
      const login = loginUseCase(userReader as unknown as IUserReaderRepository, refreshRepo, districtAdminReader);

      const result = await login(CREDS);

      expect(result.kind).toBe("enrollment-required");
      if (result.kind === "enrollment-required") expect(result.enrollToken).toBe("fake.mfa.token");
      expect(issueTokens).not.toHaveBeenCalled();
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  // Hors production, utilisateur sans TOTP → login normal (le MFA reste optionnel en dev).
  it("outside production a user without TOTP logs in normally (MFA stays optional in dev)", async () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "test";
    try {
      const userReader = makeUserReader(makeUser({ totpEnabled: false, totpSecret: null }));
      const login = loginUseCase(userReader as unknown as IUserReaderRepository, refreshRepo, districtAdminReader);

      const result = await login(CREDS);

      expect(result.kind).toBe("ok");
      expect(issueTokens).toHaveBeenCalled();
    } finally {
      process.env.NODE_ENV = prev;
    }
  });
});
