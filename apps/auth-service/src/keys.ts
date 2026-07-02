import { generateKeyPair, exportJWK, importPKCS8, importSPKI, type CryptoKey, type KeyObject } from "jose";

type KeyLike = CryptoKey | KeyObject;

let privateKey: KeyLike;
let publicKey: KeyLike;
let jwks: { keys: object[] };

export const initKeys = async () => {
  // Allow the PEM to be supplied as a single line with escaped newlines (how it
  // is stored in the SOPS-encrypted env / docker env_file) or with real newlines.
  const normalizePem = (pem?: string) => pem?.replace(/\\n/g, "\n");
  const privPem = normalizePem(process.env.AUTH_PRIVATE_KEY);
  const pubPem = normalizePem(process.env.AUTH_PUBLIC_KEY);

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
    console.warn("⚠  No AUTH_PRIVATE_KEY / AUTH_PUBLIC_KEY found — generating ephemeral dev keys");
    const pair = await generateKeyPair("RS256");
    privateKey = pair.privateKey;
    publicKey = pair.publicKey;
  }

  const pubJwk = await exportJWK(publicKey);
  jwks = {
    keys: [{ ...pubJwk, kid: "auth-1", alg: "RS256", use: "sig" }],
  };
};

export const getPrivateKey = (): KeyLike => privateKey;
export const getPublicKey = (): KeyLike => publicKey;
export const getJWKS = () => jwks;
