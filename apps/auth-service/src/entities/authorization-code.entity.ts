/**
 * A one-shot authorization code for the desktop app's PKCE login.
 *
 * Stored as a sha256 hash, like refresh tokens, so a database read (backup, log,
 * compromised replica) can't be replayed against the token endpoint. Bound to the
 * client, the exact redirect_uri, and the PKCE challenge it was minted for; all
 * three are re-checked at exchange time.
 */
export interface AuthorizationCode {
  id: string;
  codeHash: string;
  clientId: string;
  userId: string;
  /** Byte-compared against the exchange request — stored raw, never re-parsed. */
  redirectUri: string;
  /**
   * PKCE S256 challenge. Non-nullable on purpose: a nullable column would let a
   * caller omit the challenge and silently downgrade to a flow with no client
   * authentication at all, which for a public client is the only thing binding
   * the code to the app that requested it.
   */
  codeChallenge: string;
  expiresAt: string;
  /** BSON Date driving the TTL index; the ISO `expiresAt` is ignored by the TTL monitor. */
  expiresAtDate: Date;
  usedAt: string | null;
  createdAt: string;
}
