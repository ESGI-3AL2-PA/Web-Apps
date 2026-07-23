// Helpers partagés d'émission de tokens. Signe l'access token RS256 (15 min) et
// persiste le refresh token opaque (7 jours). Réutilisés par les chemins login,
// MFA et refresh pour que le jeu de claims ne diverge jamais entre eux.
import { randomBytes, createHash, randomUUID } from "crypto";
import { SignJWT } from "jose";
import { TOKEN_ISSUER, TOKEN_ALG, TOKEN_AUDIENCE, type AccessTokenClaims } from "@repo/shared";
import type { UserRecord } from "../repositories/User/user-reader.repository.js";
import type { IRefreshTokenRepository } from "../repositories/RefreshToken/refresh-token.repository.js";
import type { IDistrictAdminReaderRepository } from "../repositories/DistrictAdmin/district-admin-reader.repository.js";
import { getKeyId, getPrivateKey } from "../keys.js";

/** Tokens émis pour un utilisateur : access token, refresh token brut, et DTO utilisateur sans les secrets. */
export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  user: Omit<UserRecord, "passwordHash" | "totpSecret"> & { adminDistrictId: string | null };
}

/** Contexte d'origine d'une session (user-agent, IP) — exposé plus tard dans la vue « sessions actives ». */
export interface SessionContext {
  userAgent: string | null;
  ip: string | null;
}

/**
 * Résout l'ID du quartier administré. Seul le rôle `admin` en administre un (un
 * quartier chacun) ; `superAdmin` est global et `user` n'en administre aucun —
 * les deux résolvent à null.
 */
export const lookupAdminDistrictId = async (
  user: Pick<UserRecord, "id" | "role">,
  districtAdminReader: IDistrictAdminReaderRepository,
): Promise<string | null> => (user.role === "admin" ? await districtAdminReader.findDistrictIdByUserId(user.id) : null);

/**
 * Signe un access token RS256 de 15 minutes avec les claims standards plus les claims
 * d'autorisation à portée quartier (role + adminDistrictId). Partagé par les chemins
 * login, MFA et refresh pour que le jeu de claims ne diverge jamais entre eux.
 */
export const signAccessToken = (
  user: Pick<UserRecord, "id" | "email" | "role" | "firstName" | "lastName">,
  adminDistrictId: string | null,
): Promise<string> =>
  new SignJWT({
    email: user.email,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    adminDistrictId,
  } satisfies AccessTokenClaims)
    // Le `kid` (thumbprint de la clé) permet à l'api de retrouver la bonne clé publique via le JWKS.
    .setProtectedHeader({ alg: TOKEN_ALG, kid: getKeyId() })
    .setSubject(user.id)
    .setIssuer(TOKEN_ISSUER)
    .setAudience(TOKEN_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(getPrivateKey());

/**
 * Partagé par login + login-mfa : signe un access token, persiste un refresh token
 * et retire le hash de mot de passe (et le secret TOTP) du DTO utilisateur renvoyé.
 */
export const issueTokensForUser = async (
  user: UserRecord,
  refreshTokenRepo: IRefreshTokenRepository,
  districtAdminReader: IDistrictAdminReaderRepository,
  context?: SessionContext,
): Promise<IssuedTokens> => {
  const adminDistrictId = await lookupAdminDistrictId(user, districtAdminReader);
  const accessToken = await signAccessToken(user, adminDistrictId);

  // Refresh token opaque de 64 octets ; seule son empreinte sha256 est stockée en base.
  const rawRefreshToken = randomBytes(64).toString("hex");
  const tokenHash = createHash("sha256").update(rawRefreshToken).digest("hex");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // validité : 7 jours

  await refreshTokenRepo.create({
    userId: user.id,
    tokenHash,
    expiresAt: expiresAt.toISOString(),
    expiresAtDate: expiresAt,
    revokedAt: null,
    createdAt: now.toISOString(),
    // Identifiant de « famille » de session : stable à travers les rotations de token,
    // il permet de révoquer toute la session même si l'ID du token change à chaque refresh.
    sessionId: randomUUID(),
    userAgent: context?.userAgent ?? null,
    ip: context?.ip ?? null,
    lastUsedAt: now.toISOString(),
  });

  // Retire les champs sensibles (hash du mot de passe, secret TOTP) avant de renvoyer l'utilisateur.
  const { passwordHash: _passwordHash, totpSecret: _totpSecret, ...userDto } = user;
  return { accessToken, refreshToken: rawRefreshToken, user: { ...userDto, adminDistrictId } };
};
