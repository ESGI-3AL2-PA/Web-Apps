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

// Gestion des clés de signature RS256 de l'auth-service : chargement des PEM (inline ou
// fichier monté), dérivation du `kid`, publication du document JWKS que l'api consomme
// pour vérifier les access tokens. Expose les getters clé privée / clé publique / kid /
// JWKS consommés par le signeur de tokens et la route /.well-known/jwks.json.

type KeyLike = CryptoKey | KeyObject;

let privateKey: KeyLike;
let publicKey: KeyLike;
let keyId: string;
let jwks: { keys: JWK[] };

// Par défaut le kid vaut le thumbprint JWK RFC 7638 de la clé : c'est donc une fonction
// pure du matériel cryptographique. Cela rend la rotation dangereuse impossible par
// construction : remplacer le PEM en gardant un kid *statique* republierait un matériel
// différent sous le même kid, et les consommateurs qui ont mis le JWKS en cache par kid
// conserveraient l'ancienne clé. Le createRemoteJWKSet de jose ne re-fetch que si le kid
// est *absent* (JWKSNoMatchingKey), donc un kid réutilisé renvoie 401 silencieusement sur
// tout jusqu'à l'expiration de son cache de 10 minutes ; le client auth0 jwks-rsa utilisé
// par l'app desktop met en cache par kid sans aucun TTL.
const thumbprintKid = (jwk: JWK): Promise<string> => calculateJwkThumbprint(jwk, "sha256");

// Le PEM peut être fourni inline (AUTH_*_KEY) ou via un fichier monté (AUTH_*_KEY_FILE).
// La forme fichier permet en dev de garder des clés stables sur disque sans les committer,
// afin que les redémarrages ne fassent pas tourner les clés et n'invalident pas le cache
// JWKS de l'api.
const readPem = (inline?: string, file?: string): string | undefined =>
  inline || (file ? readFileSync(file, "utf8") : undefined);

/**
 * Construit le document JWKS à partir de JWK publiques déjà exportées.
 * Fonction pure (aucun accès à l'env ni à la crypto) donc trivialement testable.
 * Servir plus d'une clé est ce qui permet une fenêtre de rotation avec chevauchement :
 * la nouvelle clé est publiée à côté de l'ancienne, si bien que les tokens en vol signés
 * avec l'ancien kid restent vérifiables jusqu'à leur expiration.
 */
export const buildJwks = (entries: Array<{ jwk: JWK; kid: string }>): { keys: JWK[] } => ({
  keys: entries.map(({ jwk, kid }) => ({ ...jwk, kid, alg: "RS256", use: "sig" })),
});

/**
 * Charge (ou génère) les clés de signature et construit le JWKS. À appeler au démarrage
 * avant toute émission de token. Priorité : PEM fournis (inline ou fichier) ; sinon échec
 * en production ; sinon génération de clés éphémères en dev.
 */
export const initKeys = async () => {
  const privPem = readPem(process.env.AUTH_PRIVATE_KEY, process.env.AUTH_PRIVATE_KEY_FILE);
  const pubPem = readPem(process.env.AUTH_PUBLIC_KEY, process.env.AUTH_PUBLIC_KEY_FILE);

  if (privPem && pubPem) {
    privateKey = await importPKCS8(privPem, "RS256");
    publicKey = await importSPKI(pubPem, "RS256");
  } else if (process.env.NODE_ENV === "production") {
    // Des clés éphémères invalideraient silencieusement toutes les sessions à chaque
    // redémarrage et casseraient la vérification JWKS entre instances — jamais acceptable
    // en production.
    throw new Error(
      "AUTH_PRIVATE_KEY and AUTH_PUBLIC_KEY must both be set in production (refusing to generate ephemeral keys)",
    );
  } else {
    logger.warn("No AUTH_PRIVATE_KEY / AUTH_PUBLIC_KEY found — generating ephemeral dev keys");
    // Paire de clés RS256 jetable, régénérée à chaque démarrage (dev uniquement).
    const pair = await generateKeyPair("RS256");
    privateKey = pair.privateKey;
    publicKey = pair.publicKey;
  }

  const publicJwk = await exportJWK(publicKey);
  const thumbprint = await thumbprintKid(publicJwk);
  // AUTH_KEY_ID permet d'épingler un kid explicite ; sinon on retombe sur le thumbprint.
  const pinned = process.env.AUTH_KEY_ID;
  keyId = pinned || thumbprint;

  // Un kid épinglé qui ne correspond pas au thumbprint réel est le piège classique de
  // rotation : faire tourner le matériel sans changer AUTH_KEY_ID republie une clé
  // différente sous le même kid. On le signale bruyamment au boot.
  if (pinned && pinned !== thumbprint) {
    logger.warn(
      { pinned, thumbprint },
      "AUTH_KEY_ID is pinned to a value that is not this key's JWK thumbprint — rotating the key material without " +
        "also changing AUTH_KEY_ID will republish different material under the same kid and break every consumer " +
        "that cached the JWKS by kid",
    );
  }

  const entries = [{ jwk: publicJwk, kid: keyId }];

  // Ancienne clé publique optionnelle, en vérification seule. Pendant une rotation, on
  // place ici l'ancienne clé publique pour que son kid reste dans le JWKS le temps que
  // les tokens qu'elle a signés s'écoulent ; le signeur utilise toujours la clé primaire
  // (AUTH_PRIVATE_KEY / AUTH_KEY_ID).
  const prevPubPem = readPem(process.env.AUTH_PUBLIC_KEY_PREVIOUS, process.env.AUTH_PUBLIC_KEY_PREVIOUS_FILE);
  if (prevPubPem) {
    const previousPublicKey = await importSPKI(prevPubPem, "RS256");
    const previousJwk = await exportJWK(previousPublicKey);
    const previousKeyId = process.env.AUTH_KEY_ID_PREVIOUS || (await thumbprintKid(previousJwk));
    // Deux kids identiques ne serviraient à rien : une rotation exige deux kids distincts.
    if (previousKeyId === keyId) {
      throw new Error("AUTH_KEY_ID_PREVIOUS must differ from AUTH_KEY_ID (a rotation needs two distinct kids)");
    }
    entries.push({ jwk: previousJwk, kid: previousKeyId });
  }

  jwks = buildJwks(entries);

  // Une ligne qui rend visible dans le log de boot une rotation mal faite.
  logger.info(
    { kid: keyId, thumbprint, pinned: Boolean(pinned), jwksKids: jwks.keys.map((k) => k.kid) },
    "Signing keys loaded",
  );
};

// Getters sur l'état de module initialisé par initKeys().
export const getPrivateKey = (): KeyLike => privateKey; // clé de signature (émission de tokens)
export const getPublicKey = (): KeyLike => publicKey; // clé de vérification primaire
export const getKeyId = (): string => keyId; // kid inscrit dans l'en-tête des JWT signés
export const getJWKS = () => jwks; // document servi sur /.well-known/jwks.json
