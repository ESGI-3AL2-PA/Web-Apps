import type { UserRole } from "./user-document.js";

/**
 * The access-token contract shared by the signer (auth-service `issue-tokens.ts`)
 * and the verifier (api `auth.middleware.ts`). They live in different apps and had
 * independently hardcoded these values plus the claim key set; a renamed/added claim
 * wasn't caught until runtime. The signer/verifier *code* stays separate (correct);
 * only the contract is shared.
 */
export const TOKEN_ISSUER = "auth-service";
export const TOKEN_ALG = "RS256";
/** Audience minted for a normal user access token. */
export const TOKEN_AUDIENCE = "api";
/** Audience minted for the short-lived internal service token (register flow). */
export const TOKEN_AUDIENCE_INTERNAL = "api:internal";
/** Audience minted for a step-up token: fresh-TOTP proof for one sensitive operation. */
export const TOKEN_AUDIENCE_STEP_UP = "step-up";
/** Audience minted for the mandatory-enrollment ceremony ticket (prod login without TOTP). */
export const TOKEN_AUDIENCE_ENROLL = "enroll";

/** Custom claims carried in an access token, beyond the registered `sub`/`iss`/`aud`/`iat`/`exp`. */
export interface AccessTokenClaims {
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  /** District this user administers (admin role only); null otherwise. */
  adminDistrictId: string | null;
}

/**
 * Custom claims carried in a step-up token — proof that the holder re-entered a
 * fresh TOTP code moments ago, authorizing one sensitive operation. Signed with the
 * same key as the access token so the api can validate it through the same JWKS.
 */
export interface StepUpClaims {
  /** Authentication methods satisfied; always `["otp"]` here. */
  amr: string[];
  /** Unix seconds at which the second factor was verified. */
  auth_time: number;
}
