/**
 * Suite de tests du cas d'usage enroll-totp.
 *
 * Vérifie le démarrage de l'enrôlement TOTP : génération d'un secret persisté DÉSACTIVÉ
 * (enabled=false, en attente de confirmation), refus d'un utilisateur inconnu, et refus
 * de ré-enrôler un compte dont le TOTP est déjà activé.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IUserReaderRepository, UserRecord } from "../repositories/User/user-reader.repository.js";
import { enrollTotpUseCase } from "./enroll-totp.use-case.js";

// Stub otplib pour que la génération du secret soit déterministe et qu'on assertionne ce
// qui est stocké plutôt que la sortie (aléatoire) de la librairie.
vi.mock("otplib", () => ({
  authenticator: {
    generateSecret: vi.fn(() => "GENERATED-SECRET"),
    keyuri: vi.fn(() => "otpauth://totp/fake"),
  },
}));

import { authenticator } from "otplib";

const generateSecret = vi.mocked(authenticator.generateSecret);
const keyuri = vi.mocked(authenticator.keyuri);

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
  findByEmail: vi.fn().mockResolvedValue(null),
  findById: vi.fn().mockResolvedValue(user),
  setEmailVerified: vi.fn().mockResolvedValue(undefined),
  setPasswordHash: vi.fn().mockResolvedValue(undefined),
  setTotpSecret: vi.fn().mockResolvedValue(undefined),
  consumeTotpStep: vi.fn().mockResolvedValue(true),
});

describe("enrollTotpUseCase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generateSecret.mockReturnValue("GENERATED-SECRET");
    keyuri.mockReturnValue("otpauth://totp/fake");
  });

  // Génère un secret et le stocke désactivé, en attente de confirmation.
  it("generates a secret and stores it disabled, pending confirmation", async () => {
    const userReader = makeUserReader(makeUser());
    const enroll = enrollTotpUseCase(userReader as unknown as IUserReaderRepository);

    const result = await enroll("user-1");

    expect(result).toEqual({ kind: "ok", otpauthUrl: "otpauth://totp/fake", secret: "GENERATED-SECRET" });
    // Stocké avec enabled=false : le TOTP n'est actif qu'une fois basculé par confirm-totp.
    expect(userReader.setTotpSecret).toHaveBeenCalledWith("user-1", "GENERATED-SECRET", false);
  });

  // Utilisateur inconnu : retourne user-not-found et ne stocke rien.
  it("returns user-not-found and stores nothing for an unknown user", async () => {
    const userReader = makeUserReader(null);
    const enroll = enrollTotpUseCase(userReader as unknown as IUserReaderRepository);

    const result = await enroll("ghost");

    expect(result).toEqual({ kind: "user-not-found" });
    expect(userReader.setTotpSecret).not.toHaveBeenCalled();
  });

  // Refuse de ré-enrôler un utilisateur dont le TOTP est déjà activé (aucun secret régénéré).
  it("refuses to re-enroll a user that already has TOTP enabled", async () => {
    const userReader = makeUserReader(makeUser({ totpEnabled: true, totpSecret: "OLD" }));
    const enroll = enrollTotpUseCase(userReader as unknown as IUserReaderRepository);

    const result = await enroll("user-1");

    expect(result).toEqual({ kind: "already-enabled" });
    expect(generateSecret).not.toHaveBeenCalled();
    expect(userReader.setTotpSecret).not.toHaveBeenCalled();
  });
});
