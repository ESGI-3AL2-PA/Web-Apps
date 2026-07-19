import { createHash } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IAuthorizationCodeRepository } from "../repositories/AuthorizationCode/authorization-code.repository.js";
import type { IRefreshTokenRepository } from "../repositories/RefreshToken/refresh-token.repository.js";
import type { IUserReaderRepository, UserRecord } from "../repositories/User/user-reader.repository.js";
import { desktopAuthorizeUseCase } from "./desktop-authorize.use-case.js";

const REDIRECT_URI = "http://127.0.0.1:54321/callback";
const CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";
const RAW_REFRESH = "raw-refresh-token";

const futureIso = () => new Date(Date.now() + 60_000).toISOString();

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

const setup = (opts: { session?: unknown; user?: UserRecord | null } = {}) => {
  const codeRepo = { create: vi.fn().mockImplementation(async (d) => ({ ...d, id: "code-1" })) };
  const refreshRepo = {
    findActiveByTokenHash: vi
      .fn()
      .mockResolvedValue("session" in opts ? opts.session : { userId: "user-1", expiresAt: futureIso() }),
    revokeByTokenHash: vi.fn().mockResolvedValue(true),
  };
  const userReader = { findById: vi.fn().mockResolvedValue("user" in opts ? opts.user : makeUser()) };

  const run = desktopAuthorizeUseCase(
    codeRepo as unknown as IAuthorizationCodeRepository,
    refreshRepo as unknown as IRefreshTokenRepository,
    userReader as unknown as IUserReaderRepository,
  );
  return { codeRepo, refreshRepo, userReader, run };
};

const input = { rawRefreshToken: RAW_REFRESH, redirectUri: REDIRECT_URI, codeChallenge: CHALLENGE };

describe("desktopAuthorizeUseCase", () => {
  beforeEach(() => vi.clearAllMocks());

  it("issues a code for an admin and stores it hashed and bound to the request", async () => {
    const { run, codeRepo } = setup();

    const outcome = await run(input);

    expect(outcome.status).toBe("ok");
    const code = outcome.status === "ok" ? outcome.code : "";
    const stored = codeRepo.create.mock.calls[0]![0];
    // The raw code must never be persisted — only its digest.
    expect(stored.codeHash).toBe(createHash("sha256").update(code).digest("hex"));
    expect(stored.codeHash).not.toBe(code);
    expect(stored.redirectUri).toBe(REDIRECT_URI);
    expect(stored.codeChallenge).toBe(CHALLENGE);
    expect(stored.usedAt).toBeNull();
  });

  it("issues a code for a superAdmin", async () => {
    const { run } = setup({ user: makeUser({ role: "superAdmin" }) });
    await expect(run(input)).resolves.toMatchObject({ status: "ok" });
  });

  // The gate this whole flow exists for: a non-admin gets nothing to exchange.
  it("refuses a plain user and writes no code", async () => {
    const { run, codeRepo } = setup({ user: makeUser({ role: "user" }) });

    await expect(run(input)).resolves.toEqual({ status: "forbidden", reason: "role" });
    expect(codeRepo.create).not.toHaveBeenCalled();
  });

  it("refuses banned and unverified accounts", async () => {
    const banned = setup({ user: makeUser({ banned: true }) });
    await expect(banned.run(input)).resolves.toEqual({ status: "forbidden", reason: "banned" });
    expect(banned.codeRepo.create).not.toHaveBeenCalled();

    const unverified = setup({ user: makeUser({ emailVerified: false }) });
    await expect(unverified.run(input)).resolves.toEqual({ status: "forbidden", reason: "unverified" });
    expect(unverified.codeRepo.create).not.toHaveBeenCalled();
  });

  it("reports unauthenticated for a missing, unknown or expired session", async () => {
    await expect(setup().run({ ...input, rawRefreshToken: null })).resolves.toEqual({ status: "unauthenticated" });
    await expect(setup({ session: null }).run(input)).resolves.toEqual({ status: "unauthenticated" });

    const expired = setup({ session: { userId: "user-1", expiresAt: new Date(Date.now() - 1000).toISOString() } });
    await expect(expired.run(input)).resolves.toEqual({ status: "unauthenticated" });

    await expect(setup({ user: null }).run(input)).resolves.toEqual({ status: "unauthenticated" });
  });

  it("looks the session up by hash, and does not rotate it", async () => {
    const { run, refreshRepo } = setup();

    await run(input);

    // Rotating here would invalidate the cookie held by the browser tab the user
    // came from — a desktop login must not log them out of the web app.
    expect(refreshRepo.findActiveByTokenHash).toHaveBeenCalledWith(
      createHash("sha256").update(RAW_REFRESH).digest("hex"),
    );
    expect(refreshRepo).not.toHaveProperty("claimByTokenHash.mock.calls.0");
  });

  // Without this the desktop client can never switch accounts: logout only clears
  // JVM-side state, so the browser cookie re-authorizes the same user instantly.
  describe("prompt=login", () => {
    it("refuses a valid session and issues no code", async () => {
      const { run, codeRepo } = setup();

      await expect(run({ ...input, forceReauth: true })).resolves.toEqual({ status: "unauthenticated" });
      expect(codeRepo.create).not.toHaveBeenCalled();
    });

    it("revokes the session server-side, not just the browser copy", async () => {
      const { run, refreshRepo } = setup();

      await run({ ...input, forceReauth: true });

      expect(refreshRepo.revokeByTokenHash).toHaveBeenCalledWith(
        createHash("sha256").update(RAW_REFRESH).digest("hex"),
      );
    });

    it("does not revoke on a normal authorize", async () => {
      const { run, refreshRepo } = setup();

      await run(input);

      expect(refreshRepo.revokeByTokenHash).not.toHaveBeenCalled();
    });
  });

  it("mints a distinct code per call", async () => {
    const { run } = setup();
    const a = await run(input);
    const b = await run(input);
    expect(a.status === "ok" && b.status === "ok" && a.code === b.code).toBe(false);
  });
});
