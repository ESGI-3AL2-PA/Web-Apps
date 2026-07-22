import { createHash, randomBytes } from "crypto";
import type { IAuthorizationCodeRepository } from "../repositories/AuthorizationCode/authorization-code.repository.js";
import type { IRefreshTokenRepository } from "../repositories/RefreshToken/refresh-token.repository.js";
import type { IUserReaderRepository } from "../repositories/User/user-reader.repository.js";
import { ADMIN_SSO_ROLES, DESKTOP_CLIENT_ID } from "../sso/client-registry.js";

/** Codes are redeemed server-to-server within a second or two of issue. */
const CODE_TTL_MS = 60 * 1000;

export type AuthorizeOutcome =
  | { status: "unauthenticated" }
  | { status: "forbidden"; reason: "role" | "banned" | "unverified" | "totp" }
  | { status: "ok"; code: string };

export interface AuthorizeInput {
  rawRefreshToken: string | null;
  redirectUri: string;
  codeChallenge: string;
  /**
   * `prompt=login`: refuse the existing session and revoke it, so the caller is sent
   * back through the login page. This is what makes desktop account switching work.
   */
  forceReauth?: boolean;
}

/**
 * Turns the caller's existing browser session (the /auth refresh cookie) into a
 * one-shot authorization code — but only for admins.
 *
 * The role gate lives here rather than in the desktop client because the client is
 * a jar on a user's machine: any check it performs can be patched out. Refusing the
 * code server-side means a non-admin has nothing to exchange.
 */
export const desktopAuthorizeUseCase = (
  authorizationCodeRepo: IAuthorizationCodeRepository,
  refreshTokenRepo: IRefreshTokenRepository,
  userReader: IUserReaderRepository,
) => {
  return async (input: AuthorizeInput): Promise<AuthorizeOutcome> => {
    if (!input.rawRefreshToken) return { status: "unauthenticated" };

    const tokenHash = createHash("sha256").update(input.rawRefreshToken).digest("hex");

    // Revoke before refusing, so the old session cannot be reused from another tab.
    // Unlike the normal read path below, discarding this session is the whole point.
    if (input.forceReauth) {
      await refreshTokenRepo.revokeByTokenHash(tokenHash);
      return { status: "unauthenticated" };
    }

    // findActive, not claim: this is a *read* of the session. Rotating the refresh
    // token here would invalidate the cookie still held by the browser tab the user
    // came from, logging them out of the web app as a side effect of a desktop login.
    const session = await refreshTokenRepo.findActiveByTokenHash(tokenHash);
    if (!session) return { status: "unauthenticated" };
    if (new Date(session.expiresAt) < new Date()) return { status: "unauthenticated" };

    const user = await userReader.findById(session.userId);
    if (!user) return { status: "unauthenticated" };

    if (user.banned) return { status: "forbidden", reason: "banned" };
    if (!user.emailVerified) return { status: "forbidden", reason: "unverified" };
    if (!ADMIN_SSO_ROLES.has(user.role)) return { status: "forbidden", reason: "role" };
    // Defense-in-depth for mandatory MFA: even though a desktop code is minted from an
    // existing web session (which in prod only exists post-enrollment), refuse to issue one
    // for a non-enrolled admin so this path can never become an MFA bypass.
    if (process.env.NODE_ENV === "production" && !user.totpEnabled) return { status: "forbidden", reason: "totp" };

    const code = randomBytes(32).toString("hex");
    const now = new Date();
    const expiresAt = new Date(now.getTime() + CODE_TTL_MS);

    await authorizationCodeRepo.create({
      codeHash: createHash("sha256").update(code).digest("hex"),
      clientId: DESKTOP_CLIENT_ID,
      userId: user.id,
      redirectUri: input.redirectUri,
      codeChallenge: input.codeChallenge,
      expiresAt: expiresAt.toISOString(),
      expiresAtDate: expiresAt,
      usedAt: null,
      createdAt: now.toISOString(),
    });

    return { status: "ok", code };
  };
};
