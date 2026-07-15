import { readFileSync } from "fs";
import { generateKeyPair, exportJWK, importPKCS8, importSPKI, type CryptoKey, type JWK, type KeyObject } from "jose";
import { logger } from "./logger.js";

type KeyLike = CryptoKey | KeyObject;

let privateKey: KeyLike;
let publicKey: KeyLike;
let keyId: string;
let jwks: { keys: JWK[] };

// The active signing key id. Configurable so a rotation can publish a new key
// under a fresh kid without a code change; defaults to the historical value so
// nothing changes for existing deployments.
const DEFAULT_KEY_ID = "auth-1";
const DEFAULT_PREVIOUS_KEY_ID = "auth-0";

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
  keyId = process.env.AUTH_KEY_ID || DEFAULT_KEY_ID;

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

  const entries = [{ jwk: await exportJWK(publicKey), kid: keyId }];

  // Optional verify-only previous public key. During a rotation, set the old
  // public key here so its kid stays in the JWKS while tokens it signed drain;
  // the signer always uses the primary (AUTH_PRIVATE_KEY / AUTH_KEY_ID).
  const prevPubPem = readPem(process.env.AUTH_PUBLIC_KEY_PREVIOUS, process.env.AUTH_PUBLIC_KEY_PREVIOUS_FILE);
  if (prevPubPem) {
    const previousKeyId = process.env.AUTH_KEY_ID_PREVIOUS || DEFAULT_PREVIOUS_KEY_ID;
    if (previousKeyId === keyId) {
      throw new Error("AUTH_KEY_ID_PREVIOUS must differ from AUTH_KEY_ID (a rotation needs two distinct kids)");
    }
    const previousPublicKey = await importSPKI(prevPubPem, "RS256");
    entries.push({ jwk: await exportJWK(previousPublicKey), kid: previousKeyId });
  }

  jwks = buildJwks(entries);
};

export const getPrivateKey = (): KeyLike => privateKey;
export const getPublicKey = (): KeyLike => publicKey;
export const getKeyId = (): string => keyId;
export const getJWKS = () => jwks;
