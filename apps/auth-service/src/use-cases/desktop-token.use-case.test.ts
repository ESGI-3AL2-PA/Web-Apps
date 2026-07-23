/**
 * Suite de tests du cas d'usage desktop-token (étape /token du SSO desktop).
 *
 * Vérifie l'échange code -> access token : le code est réclamé atomiquement par hash
 * AVANT tout autre contrôle (anti-rejeu), puis validé (expiration, PKCE, redirect_uri,
 * client_id) et le rôle est re-contrôlé au moment de l'échange (déni d'un compte
 * rétrogradé/banni après émission). Distingue invalid_grant et access_denied.
 */
import { createHash } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IAuthorizationCodeRepository } from "../repositories/AuthorizationCode/authorization-code.repository.js";
import type { IDistrictAdminReaderRepository } from "../repositories/DistrictAdmin/district-admin-reader.repository.js";
import type { IUserReaderRepository, UserRecord } from "../repositories/User/user-reader.repository.js";
import { desktopTokenUseCase } from "./desktop-token.use-case.js";

// La signature est testée pour de vrai via issue-tokens ailleurs ; on la stub pour que
// ces tests n'aient pas besoin d'une paire de clés RS256 initialisée.
vi.mock("./issue-tokens.js", () => ({
  signAccessToken: vi.fn().mockResolvedValue("fake.access.token"),
  lookupAdminDistrictId: vi.fn().mockResolvedValue(null),
}));

const VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
const CHALLENGE = createHash("sha256").update(VERIFIER).digest("base64url");
const REDIRECT_URI = "http://127.0.0.1:54321/callback";
const CLIENT_ID = "admin-desktop";
const CODE = "the-raw-code";

const makeUser = (over: Partial<UserRecord> = {}): UserRecord =>
  ({
    id: "user-1",
    email: "admin@example.com",
    role: "admin",
    firstName: "Ada",
    lastName: "Admin",
    banned: false,
    emailVerified: true,
    ...over,
  }) as UserRecord;

const storedCode = (over: Record<string, unknown> = {}) => ({
  id: "code-1",
  codeHash: createHash("sha256").update(CODE).digest("hex"),
  clientId: CLIENT_ID,
  userId: "user-1",
  redirectUri: REDIRECT_URI,
  codeChallenge: CHALLENGE,
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  usedAt: null,
  createdAt: new Date().toISOString(),
  ...over,
});

const setup = (opts: { stored?: unknown; user?: UserRecord | null } = {}) => {
  const codeRepo = { claimByCodeHash: vi.fn().mockResolvedValue("stored" in opts ? opts.stored : storedCode()) };
  const userReader = { findById: vi.fn().mockResolvedValue("user" in opts ? opts.user : makeUser()) };
  const districtAdmin = { findDistrictIdByUserId: vi.fn().mockResolvedValue(null) };

  const run = desktopTokenUseCase(
    codeRepo as unknown as IAuthorizationCodeRepository,
    userReader as unknown as IUserReaderRepository,
    districtAdmin as unknown as IDistrictAdminReaderRepository,
  );
  return { codeRepo, userReader, run };
};

const input = { code: CODE, redirectUri: REDIRECT_URI, clientId: CLIENT_ID, codeVerifier: VERIFIER };

describe("desktopTokenUseCase", () => {
  beforeEach(() => vi.clearAllMocks());

  // Échange un code valide contre un access token (expires_in = 900 s).
  it("exchanges a valid code for an access token", async () => {
    const { run } = setup();
    await expect(run(input)).resolves.toEqual({
      status: "ok",
      accessToken: "fake.access.token",
      expiresIn: 900,
    });
  });

  // Réclame le code atomiquement, par hash, avant tout autre contrôle.
  it("claims the code atomically, by hash, before any other check", async () => {
    const { run, codeRepo } = setup();

    // Un mauvais redirect_uri consomme quand même le code : réclamer d'abord empêche un
    // rejeu de sonder les autres contrôles en faisant varier les paramètres.
    await run({ ...input, redirectUri: "http://127.0.0.1:9/callback" });

    expect(codeRepo.claimByCodeHash).toHaveBeenCalledWith(createHash("sha256").update(CODE).digest("hex"));
  });

  // Code déjà réclamé ou inconnu => invalid_grant.
  it("rejects an already-claimed or unknown code", async () => {
    const { run } = setup({ stored: null });
    await expect(run(input)).resolves.toEqual({ status: "invalid_grant" });
  });

  // Code expiré => invalid_grant.
  it("rejects an expired code", async () => {
    const { run } = setup({ stored: storedCode({ expiresAt: new Date(Date.now() - 1000).toISOString() }) });
    await expect(run(input)).resolves.toEqual({ status: "invalid_grant" });
  });

  // Verifier PKCE ne correspondant pas au challenge stocké => invalid_grant.
  it("rejects a mismatched PKCE verifier", async () => {
    const { run } = setup();
    await expect(run({ ...input, codeVerifier: "x".repeat(43) })).resolves.toEqual({ status: "invalid_grant" });
  });

  // Code détourné vers un redirect_uri ou un client différent => invalid_grant.
  it("rejects a code bent to a different redirect_uri or client", async () => {
    await expect(setup().run({ ...input, redirectUri: "http://127.0.0.1:9/callback" })).resolves.toEqual({
      status: "invalid_grant",
    });
    await expect(setup().run({ ...input, clientId: "someone-else" })).resolves.toEqual({ status: "invalid_grant" });
  });

  // Authorize et token sont espacés d'une minute au plus ; le verrou est ré-exécuté pour
  // qu'une rétrogradation entre-temps ne soit pas masquée par un code valide à l'émission.
  it("re-checks the role at exchange time and denies a demoted user", async () => {
    const { run } = setup({ user: makeUser({ role: "user" }) });
    await expect(run(input)).resolves.toEqual({ status: "access_denied" });
  });

  // Refuse un utilisateur banni après l'émission du code => access_denied.
  it("denies a user banned after the code was issued", async () => {
    const { run } = setup({ user: makeUser({ banned: true }) });
    await expect(run(input)).resolves.toEqual({ status: "access_denied" });
  });

  // Code dont l'utilisateur n'existe plus => invalid_grant.
  it("rejects a code whose user no longer exists", async () => {
    const { run } = setup({ user: null });
    await expect(run(input)).resolves.toEqual({ status: "invalid_grant" });
  });
});
