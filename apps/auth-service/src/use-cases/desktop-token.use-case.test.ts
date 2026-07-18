import { createHash } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IAuthorizationCodeRepository } from "../repositories/AuthorizationCode/authorization-code.repository.js";
import type { IDistrictAdminReaderRepository } from "../repositories/DistrictAdmin/district-admin-reader.repository.js";
import type { IUserReaderRepository, UserRecord } from "../repositories/User/user-reader.repository.js";
import { desktopTokenUseCase } from "./desktop-token.use-case.js";

// Signing is exercised for real via issue-tokens elsewhere; stub it so these tests
// don't need an initialised RS256 keypair.
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

  it("exchanges a valid code for an access token", async () => {
    const { run } = setup();
    await expect(run(input)).resolves.toEqual({
      status: "ok",
      accessToken: "fake.access.token",
      expiresIn: 900,
    });
  });

  it("claims the code atomically, by hash, before any other check", async () => {
    const { run, codeRepo } = setup();

    // A wrong redirect_uri still consumes the code: claiming first means a replay
    // can't probe the other checks by varying parameters.
    await run({ ...input, redirectUri: "http://127.0.0.1:9/callback" });

    expect(codeRepo.claimByCodeHash).toHaveBeenCalledWith(createHash("sha256").update(CODE).digest("hex"));
  });

  it("rejects an already-claimed or unknown code", async () => {
    const { run } = setup({ stored: null });
    await expect(run(input)).resolves.toEqual({ status: "invalid_grant" });
  });

  it("rejects an expired code", async () => {
    const { run } = setup({ stored: storedCode({ expiresAt: new Date(Date.now() - 1000).toISOString() }) });
    await expect(run(input)).resolves.toEqual({ status: "invalid_grant" });
  });

  it("rejects a mismatched PKCE verifier", async () => {
    const { run } = setup();
    await expect(run({ ...input, codeVerifier: "x".repeat(43) })).resolves.toEqual({ status: "invalid_grant" });
  });

  it("rejects a code bent to a different redirect_uri or client", async () => {
    await expect(setup().run({ ...input, redirectUri: "http://127.0.0.1:9/callback" })).resolves.toEqual({
      status: "invalid_grant",
    });
    await expect(setup().run({ ...input, clientId: "someone-else" })).resolves.toEqual({ status: "invalid_grant" });
  });

  // Authorize and token are up to a minute apart; the gate is re-run so a demotion
  // in between isn't papered over by a code that was valid when issued.
  it("re-checks the role at exchange time and denies a demoted user", async () => {
    const { run } = setup({ user: makeUser({ role: "user" }) });
    await expect(run(input)).resolves.toEqual({ status: "access_denied" });
  });

  it("denies a user banned after the code was issued", async () => {
    const { run } = setup({ user: makeUser({ banned: true }) });
    await expect(run(input)).resolves.toEqual({ status: "access_denied" });
  });

  it("rejects a code whose user no longer exists", async () => {
    const { run } = setup({ user: null });
    await expect(run(input)).resolves.toEqual({ status: "invalid_grant" });
  });
});
