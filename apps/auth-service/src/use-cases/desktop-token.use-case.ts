// Cas d'usage — étape « token » du flux SSO OAuth du client desktop admin. Échange
// le code d'autorisation à usage unique (émis par desktop-authorize) contre un access
// token, en vérifiant PKCE et en re-jouant le contrôle de rôle au moment de l'échange.
import { createHash, timingSafeEqual } from "crypto";
import type { IAuthorizationCodeRepository } from "../repositories/AuthorizationCode/authorization-code.repository.js";
import type { IUserReaderRepository } from "../repositories/User/user-reader.repository.js";
import type { IDistrictAdminReaderRepository } from "../repositories/DistrictAdmin/district-admin-reader.repository.js";
import { ADMIN_SSO_ROLES } from "../sso/client-registry.js";
import { lookupAdminDistrictId, signAccessToken } from "./issue-tokens.js";

/** Reflète la durée de vie de l'access token dans issue-tokens.ts. */
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
 * Échange un code d'autorisation à usage unique contre un access token.
 *
 * Le token renvoyé est le token first-party ordinaire produit par `signAccessToken` —
 * même émetteur, même `aud: "api"`, mêmes claims. Une audience spécifique au client
 * desktop a été envisagée puis écartée : l'api doit de toute façon continuer d'accepter
 * "api" pour l'admin-front, donc une audience distincte serait une étiquette plutôt
 * qu'une frontière de sécurité, et casserait l'appel /auth/userinfo du client lui-même,
 * qui épingle `audience: "api"`.
 */
export const desktopTokenUseCase = (
  authorizationCodeRepo: IAuthorizationCodeRepository,
  userReader: IUserReaderRepository,
  districtAdminReader: IDistrictAdminReaderRepository,
) => {
  return async (input: TokenInput): Promise<TokenOutcome> => {
    const codeHash = createHash("sha256").update(input.code).digest("hex");

    // Revendication atomique à usage unique, en premier : un code rejoué ne trouve rien
    // et échoue ici, avant que les contrôles ci-dessous ne puissent révéler s'il était
    // par ailleurs bien formé.
    const stored = await authorizationCodeRepo.claimByCodeHash(codeHash);
    if (!stored) return { status: "invalid_grant" };

    if (new Date(stored.expiresAt) < new Date()) return { status: "invalid_grant" };

    // Lié au client et à l'exact redirect_uri pour lequel le code a été émis. Comparaison
    // octet par octet avec la chaîne stockée — ne jamais ré-analyser l'URL, car une URL
    // qui se re-sérialise différemment comparerait inégale sans aucune raison de sécurité.
    if (stored.clientId !== input.clientId) return { status: "invalid_grant" };
    if (stored.redirectUri !== input.redirectUri) return { status: "invalid_grant" };

    // PKCE : prouve que cet échange provient bien du processus qui a initié le flux.
    // Pour un client public sur une machine partagée, c'est la seule preuve de ce genre.
    const challenge = createHash("sha256").update(input.codeVerifier).digest("base64url");
    if (!constantTimeEquals(challenge, stored.codeChallenge)) return { status: "invalid_grant" };

    // Relit l'utilisateur et rejoue tout le contrôle d'accès. Authorize et token sont
    // deux requêtes distinctes espacées d'une minute au plus ; une rétrogradation ou un
    // bannissement survenu entre-temps ne doit pas être masqué par un code qui était
    // valide au moment de son émission.
    const user = await userReader.findById(stored.userId);
    if (!user) return { status: "invalid_grant" };
    if (user.banned || !user.emailVerified || !ADMIN_SSO_ROLES.has(user.role)) {
      return { status: "access_denied" };
    }
    // MFA obligatoire (prod) : un code émis juste avant l'enrôlement ne doit pas être échangeable.
    if (process.env.NODE_ENV === "production" && !user.totpEnabled) return { status: "access_denied" };

    const adminDistrictId = await lookupAdminDistrictId(user, districtAdminReader);
    const accessToken = await signAccessToken(user, adminDistrictId);

    return { status: "ok", accessToken, expiresIn: ACCESS_TOKEN_TTL_SECONDS };
  };
};
