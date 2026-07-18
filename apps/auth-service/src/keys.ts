import { readFileSync } from "fs";
import {
  calculateJwkThumbprint,
  generateKeyPair,
  exportJWK,
  importPKCS8,
  importSPKI,
  type CryptoKey,
  type JWK,
  type KeyObject,
} from "jose";
import { logger } from "./logger.js";

type KeyLike = CryptoKey | KeyObject;

let privateKey: KeyLike;
let publicKey: KeyLike;
let keyId: string;
let jwks: { keys: JWK[] };

// The kid defaults to the key's RFC 7638 JWK thumbprint, so it is a pure function
// of the key material. That makes the dangerous rotation impossible by construction:
// swapping the PEM while leaving a *static* kid republishes different material under
// the same kid, and consumers that cached the JWKS by kid keep the stale key. jose's
// createRemoteJWKSet only refetches when a kid is *absent* (JWKSNoMatchingKey), so a
// reused kid silently 401s everything until its 10-minute cache lapses; the auth0
// jwks-rsa client the desktop app uses caches by kid with no TTL at all.
const thumbprintKid = (jwk: JWK): Promise<string> => calculateJwkThumbprint(jwk, "sha256");

// The PEM can be provided inline (AUTH_*_KEY) or via a mounted file (AUTH_*_KEY_FILE).
// The file form lets dev keep stable keys on disk without committing them, so
// restarts don't rotate keys and invalidate the api's JWKS cache.
const readPem = (inline?: string, file?: string): string | undefined =>
  inline || (file ? readFileSync(file, "utf8") : undefined);

// Builds the JWKS document from already-exported public JWKs. Kept pure (no env
// or crypto access) so the shape is trivially unit-testable. Serving more than
// one key is what enables an overlapping rotation window: the new key is
// published alongside the old so in-flight tokens signed with the old kid still
// verify until they expire.
export const buildJwks = (entries: Array<{ jwk: JWK; kid: string }>): { keys: JWK[] } => ({
  keys: entries.map(({ jwk, kid }) => ({ ...jwk, kid, alg: "RS256", use: "sig" })),
});

export const initKeys = async () => {
  const privPem = readPem(process.env.AUTH_PRIVATE_KEY, process.env.AUTH_PRIVATE_KEY_FILE);
  const pubPem = readPem(process.env.AUTH_PUBLIC_KEY, process.env.AUTH_PUBLIC_KEY_FILE);

  if (privPem && pubPem) {
    privateKey = await importPKCS8(privPem, "RS256");
    publicKey = await importSPKI(pubPem, "RS256");
  } else if (process.env.NODE_ENV === "production") {
    // Ephemeral keys would silently invalidate every session on each restart and break JWKS
    // verification across instances — never acceptable in production.
    throw new Error(
      "AUTH_PRIVATE_KEY and AUTH_PUBLIC_KEY must both be set in production (refusing to generate ephemeral keys)",
    );
  } else {
    logger.warn("No AUTH_PRIVATE_KEY / AUTH_PUBLIC_KEY found — generating ephemeral dev keys");
    const pair = await generateKeyPair("RS256");
    privateKey = pair.privateKey;
    publicKey = pair.publicKey;
  }

  const publicJwk = await exportJWK(publicKey);
  const thumbprint = await thumbprintKid(publicJwk);
  const pinned = process.env.AUTH_KEY_ID;
  keyId = pinned || thumbprint;

  if (pinned && pinned !== thumbprint) {
    logger.warn(
      { pinned, thumbprint },
      "AUTH_KEY_ID is pinned to a value that is not this key's JWK thumbprint — rotating the key material without " +
        "also changing AUTH_KEY_ID will republish different material under the same kid and break every consumer " +
        "that cached the JWKS by kid",
    );
  }

  const entries = [{ jwk: publicJwk, kid: keyId }];

  // Optional verify-only previous public key. During a rotation, set the old
  // public key here so its kid stays in the JWKS while tokens it signed drain;
  // the signer always uses the primary (AUTH_PRIVATE_KEY / AUTH_KEY_ID).
  const prevPubPem = readPem(process.env.AUTH_PUBLIC_KEY_PREVIOUS, process.env.AUTH_PUBLIC_KEY_PREVIOUS_FILE);
  if (prevPubPem) {
    const previousPublicKey = await importSPKI(prevPubPem, "RS256");
    const previousJwk = await exportJWK(previousPublicKey);
    const previousKeyId = process.env.AUTH_KEY_ID_PREVIOUS || (await thumbprintKid(previousJwk));
    if (previousKeyId === keyId) {
      throw new Error("AUTH_KEY_ID_PREVIOUS must differ from AUTH_KEY_ID (a rotation needs two distinct kids)");
    }
    entries.push({ jwk: previousJwk, kid: previousKeyId });
  }

  jwks = buildJwks(entries);

  // One line that makes a botched rotation visible in the boot log.
  logger.info(
    { kid: keyId, thumbprint, pinned: Boolean(pinned), jwksKids: jwks.keys.map((k) => k.kid) },
    "Signing keys loaded",
  );
};

export const getPrivateKey = (): KeyLike => privateKey;
export const getPublicKey = (): KeyLike => publicKey;
export const getKeyId = (): string => keyId;
export const getJWKS = () => jwks;
