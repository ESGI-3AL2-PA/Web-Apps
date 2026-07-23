import { createHash } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthToken } from "../entities/auth-token.entity.js";
import type { IAuthTokenRepository } from "../repositories/AuthToken/auth-token.repository.js";
import type { IRefreshTokenRepository } from "../repositories/RefreshToken/refresh-token.repository.js";
import type { IUserReaderRepository, UserRecord } from "../repositories/User/user-reader.repository.js";
import { resetPasswordUseCase } from "./reset-password.use-case.js";

/**
 * Suite de tests du cas d'usage de réinitialisation de mot de passe.
 *
 * Couvre les quatre issues : token valide (mot de passe changé, token brûlé,
 * autres sessions déconnectées), token inconnu/réutilisé, token expiré, et compte
 * supprimé.
 */

// Le vrai hashage argon2 est lent et sans intérêt ici ; on vérifie que
// setPasswordHash est appelé avec le hash dérivé, pas son contenu réel.
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

  // Token valide : met à jour le mot de passe, consomme le token, déconnecte les autres sessions.
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
    // Le token est recherché par son hash sha256, restreint au type reset_password.
    expect(authTokenRepo.findActiveByHash).toHaveBeenCalledWith(TOKEN_HASH, "reset_password");
    expect(userReader.setPasswordHash).toHaveBeenCalledWith("user-1", "new-password-hash");
    // Usage unique : le token est brûlé.
    expect(authTokenRepo.markUsed).toHaveBeenCalledWith("token-1");
    // Toute session existante est invalidée après un changement de mot de passe.
    expect(refreshRepo.revokeAllForUser).toHaveBeenCalledWith("user-1");
  });

  // Token inconnu/réutilisé : rejeté comme invalide sans toucher au mot de passe.
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

  // Token expiré : brûlé et rejeté, le mot de passe reste inchangé.
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
    // Même expirée, la ligne est marquée utilisée pour ne pas pouvoir être réessayée.
    expect(authTokenRepo.markUsed).toHaveBeenCalledWith("token-1");
    expect(userReader.setPasswordHash).not.toHaveBeenCalled();
    expect(refreshRepo.revokeAllForUser).not.toHaveBeenCalled();
  });

  // Renvoie user-not-found quand le token référence un compte supprimé.
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
