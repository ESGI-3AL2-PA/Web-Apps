import { createHash, timingSafeEqual } from "crypto";
import type { IAuthorizationCodeRepository } from "../repositories/AuthorizationCode/authorization-code.repository.js";
import type { IUserReaderRepository } from "../repositories/User/user-reader.repository.js";
import type { IDistrictAdminReaderRepository } from "../repositories/DistrictAdmin/district-admin-reader.repository.js";
import { ADMIN_SSO_ROLES } from "../sso/client-registry.js";
import { lookupAdminDistrictId, signAccessToken } from "./issue-tokens.js";

/** Mirrors the access-token lifetime in issue-tokens.ts. */
const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

export type TokenOutcome =
  | { status: "invalid_grant" }
  | { status: "access_denied" }
  | { status: "ok"; accessToken: string; expiresIn: number };

export interface TokenInput {
  code: string;
  redirectUri: string;
  clientId: string;
  codeVerifier: string;
}

const constantTimeEquals = (a: string, b: string): boolean => {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
};

/**
 * Redeems a one-shot authorization code for an access token.
 *
 * The token is the ordinary first-party token from `signAccessToken` — same issuer,
 * same `aud: "api"`, same claims. A desktop-specific audience was considered and
 * rejected: the api must keep accepting "api" for admin-front regardless, so a
 * separate audience would be a label rather than a boundary, and it would break the
 * client's own /auth/userinfo call, which pins `audience: "api"`.
 */
export const desktopTokenUseCase = (
  authorizationCodeRepo: IAuthorizationCodeRepository,
  userReader: IUserReaderRepository,
  districtAdminReader: IDistrictAdminReaderRepository,
) => {
  return async (input: TokenInput): Promise<TokenOutcome> => {
    const codeHash = createHash("sha256").update(input.code).digest("hex");

    // Atomic single-use claim, first: a replayed code finds nothing and dies here,
    // before any of the checks below can leak whether it was otherwise well-formed.
    const stored = await authorizationCodeRepo.claimByCodeHash(codeHash);
    if (!stored) return { status: "invalid_grant" };

    if (new Date(stored.expiresAt) < new Date()) return { status: "invalid_grant" };

    // Bound to the client and the exact redirect_uri it was minted for. Byte
    // comparison against the stored string — never re-parse, since a URL that
    // re-serialises differently would compare unequal for no security reason.
    if (stored.clientId !== input.clientId) return { status: "invalid_grant" };
    if (stored.redirectUri !== input.redirectUri) return { status: "invalid_grant" };

    // PKCE: proves this exchange comes from the process that started the flow.
    // For a public client on a shared machine it is the only such proof.
    const challenge = createHash("sha256").update(input.codeVerifier).digest("base64url");
    if (!constantTimeEquals(challenge, stored.codeChallenge)) return { status: "invalid_grant" };

    // Re-read the user and re-run the whole gate. Authorize and token are separate
    // requests up to a minute apart; a demotion or ban in between must not be
    // papered over by a code that was valid when it was issued.
    const user = await userReader.findById(stored.userId);
    if (!user) return { status: "invalid_grant" };
    if (user.banned || !user.emailVerified || !ADMIN_SSO_ROLES.has(user.role)) {
      return { status: "access_denied" };
    }

    const adminDistrictId = await lookupAdminDistrictId(user, districtAdminReader);
    const accessToken = await signAccessToken(user, adminDistrictId);

    return { status: "ok", accessToken, expiresIn: ACCESS_TOKEN_TTL_SECONDS };
  };
};
