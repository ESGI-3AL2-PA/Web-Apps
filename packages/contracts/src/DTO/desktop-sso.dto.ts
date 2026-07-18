import { z } from "zod";

/**
 * Wire shapes for the desktop app's PKCE authorization-code login.
 *
 * These endpoints are not in a ts-rest contract: /authorize answers with a 302 and
 * /token takes application/x-www-form-urlencoded, neither of which ts-rest models,
 * and no TypeScript client calls them (the consumer is the JavaFX app). The schemas
 * still live here so request validation has one source of truth, matching how the
 * rest of the workspace is organised.
 */

/** RFC 7636 §4.1: the verifier is 43-128 chars, and the S256 challenge is its base64url digest. */
const PKCE_LENGTH = { min: 43, max: 128 } as const;

export const DesktopAuthorizeQuerySchema = z.object({
  response_type: z.literal("code"),
  client_id: z.string().min(1).max(64),
  redirect_uri: z.string().min(1).max(512),
  state: z.string().min(1).max(256),
  code_challenge: z.string().min(PKCE_LENGTH.min).max(PKCE_LENGTH.max),
  // S256 only. RFC 7636 also defines "plain", which offers no protection at all
  // against a local process that can read the authorization request.
  code_challenge_method: z.literal("S256"),
});

export const DesktopTokenRequestSchema = z.object({
  grant_type: z.literal("authorization_code"),
  code: z.string().min(1).max(256),
  redirect_uri: z.string().min(1).max(512),
  client_id: z.string().min(1).max(64),
  code_verifier: z.string().min(PKCE_LENGTH.min).max(PKCE_LENGTH.max),
});

export const DesktopTokenResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.literal("Bearer"),
  expires_in: z.number().int().positive(),
});

export type DesktopAuthorizeQuery = z.infer<typeof DesktopAuthorizeQuerySchema>;
export type DesktopTokenRequest = z.infer<typeof DesktopTokenRequestSchema>;
export type DesktopTokenResponse = z.infer<typeof DesktopTokenResponseSchema>;
