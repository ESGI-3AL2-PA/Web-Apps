/**
 * Suite de tests du cas d'usage verifyEmailUseCase. Vérifie les quatre issues :
 * token valide (e-mail vérifié + token consommé), token inconnu/réutilisé,
 * token expiré (brûlé sans vérifier), et compte supprimé (user-not-found).
 * Les repositories sont mockés via vi.fn() ; aucune I/O réelle.
 */
import { createHash } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthToken } from "../entities/auth-token.entity.js";
import type { IAuthTokenRepository } from "../repositories/AuthToken/auth-token.repository.js";
import type { IUserReaderRepository, UserRecord } from "../repositories/User/user-reader.repository.js";
import { verifyEmailUseCase } from "./verify-email.use-case.js";

// Token en clair et son empreinte sha256 attendue (le use-case cherche par hash).
const RAW_TOKEN = "raw-verify-token";
const TOKEN_HASH = createHash("sha256").update(RAW_TOKEN).digest("hex");

// Deux échéances : une dans le futur (token valide), une passée (token expiré).
const futureIso = new Date(Date.now() + 60 * 60 * 1000).toISOString();
const pastIso = new Date(Date.now() - 60 * 60 * 1000).toISOString();

/** Fabrique un AuthToken de test, surchargeable champ par champ via `over`. */
const makeRecord = (over: Partial<AuthToken> = {}): AuthToken => ({
  id: "token-1",
  userId: "user-1",
  tokenHash: TOKEN_HASH,
  type: "verify_email",
  expiresAt: futureIso,
  usedAt: null,
  createdAt: new Date().toISOString(),
  ...over,
});

/** Fabrique un UserRecord de test (e-mail non vérifié par défaut). */
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
  emailVerified: false,
  totpSecret: null,
  totpEnabled: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...over,
});

type AuthTokenRepoMock = { [K in keyof IAuthTokenRepository]: ReturnType<typeof vi.fn> };
type UserReaderMock = { [K in keyof IUserReaderRepository]: ReturnType<typeof vi.fn> };

// Mock du repository AuthToken : findActiveByHash renvoie le `record` fourni.
const makeAuthTokenRepo = (record: AuthToken | null): AuthTokenRepoMock => ({
  create: vi.fn(),
  findActiveByHash: vi.fn().mockResolvedValue(record),
  markUsed: vi.fn().mockResolvedValue(undefined),
  revokeAllForUser: vi.fn().mockResolvedValue(undefined),
});

// Mock du repository UserReader : findById renvoie le `user` fourni (ou null).
const makeUserReader = (user: UserRecord | null): UserReaderMock => ({
  findByEmail: vi.fn().mockResolvedValue(null),
  findById: vi.fn().mockResolvedValue(user),
  setEmailVerified: vi.fn().mockResolvedValue(undefined),
  setPasswordHash: vi.fn().mockResolvedValue(undefined),
  setTotpSecret: vi.fn().mockResolvedValue(undefined),
  consumeTotpStep: vi.fn().mockResolvedValue(true),
});

describe("verifyEmailUseCase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Token valide : e-mail marqué vérifié et token consommé (markUsed).
  it("a valid token marks the email verified and consumes the token", async () => {
    const authTokenRepo = makeAuthTokenRepo(makeRecord());
    const userReader = makeUserReader(makeUser());
    const verify = verifyEmailUseCase(
      authTokenRepo as unknown as IAuthTokenRepository,
      userReader as unknown as IUserReaderRepository,
    );

    const result = await verify(RAW_TOKEN);

    expect(result).toBe("ok");
    expect(authTokenRepo.findActiveByHash).toHaveBeenCalledWith(TOKEN_HASH, "verify_email");
    expect(userReader.setEmailVerified).toHaveBeenCalledWith("user-1");
    expect(authTokenRepo.markUsed).toHaveBeenCalledWith("token-1");
  });

  // Token introuvable (inconnu ou déjà utilisé) : rejeté en "invalid", aucun effet.
  it("an unknown/reused token is rejected as invalid", async () => {
    const authTokenRepo = makeAuthTokenRepo(null);
    const userReader = makeUserReader(makeUser());
    const verify = verifyEmailUseCase(
      authTokenRepo as unknown as IAuthTokenRepository,
      userReader as unknown as IUserReaderRepository,
    );

    const result = await verify(RAW_TOKEN);

    expect(result).toBe("invalid");
    expect(userReader.setEmailVerified).not.toHaveBeenCalled();
    expect(authTokenRepo.markUsed).not.toHaveBeenCalled();
  });

  // Token expiré : brûlé (markUsed) mais l'e-mail n'est pas vérifié.
  it("an expired token is burned and rejected without verifying the email", async () => {
    const authTokenRepo = makeAuthTokenRepo(makeRecord({ expiresAt: pastIso }));
    const userReader = makeUserReader(makeUser());
    const verify = verifyEmailUseCase(
      authTokenRepo as unknown as IAuthTokenRepository,
      userReader as unknown as IUserReaderRepository,
    );

    const result = await verify(RAW_TOKEN);

    expect(result).toBe("expired");
    expect(authTokenRepo.markUsed).toHaveBeenCalledWith("token-1");
    expect(userReader.setEmailVerified).not.toHaveBeenCalled();
  });

  // Token valide mais compte supprimé : "user-not-found", ni vérif ni consommation.
  it("returns user-not-found when the token references a deleted account", async () => {
    const authTokenRepo = makeAuthTokenRepo(makeRecord());
    const userReader = makeUserReader(null);
    const verify = verifyEmailUseCase(
      authTokenRepo as unknown as IAuthTokenRepository,
      userReader as unknown as IUserReaderRepository,
    );

    const result = await verify(RAW_TOKEN);

    expect(result).toBe("user-not-found");
    expect(userReader.setEmailVerified).not.toHaveBeenCalled();
    expect(authTokenRepo.markUsed).not.toHaveBeenCalled();
  });
});
