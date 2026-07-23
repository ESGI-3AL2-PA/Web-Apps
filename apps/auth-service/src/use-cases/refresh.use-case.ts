/**
 * Cas d'usage : rotation du refresh token.
 *
 * Couche use-case de l'auth-service. À chaque appel de refresh, l'ancien refresh
 * token est révoqué (rotation stricte) et un nouvel access token + refresh token
 * sont émis. La détection de réutilisation d'un token déjà tourné sert de garde
 * anti-vol de session.
 */
import { randomBytes, createHash } from "crypto";
import type { IRefreshTokenRepository } from "../repositories/RefreshToken/refresh-token.repository.js";
import type { IUserReaderRepository } from "../repositories/User/user-reader.repository.js";
import type { IDistrictAdminReaderRepository } from "../repositories/DistrictAdmin/district-admin-reader.repository.js";
import { lookupAdminDistrictId, signAccessToken } from "./issue-tokens.js";

interface RefreshResult {
  accessToken: string;
  refreshToken: string;
}

/**
 * Factory du cas d'usage de refresh.
 *
 * @returns Une fonction prenant le refresh token brut ; elle renvoie le nouveau
 *   couple de tokens, ou `null` si le token est invalide / expiré / rejeté
 *   (utilisateur banni, replay détecté). Un `null` doit conduire l'appelant à
 *   effacer les cookies et répondre 401.
 */
export const refreshUseCase = (
  refreshTokenRepo: IRefreshTokenRepository,
  userReader: IUserReaderRepository,
  districtAdminReader: IDistrictAdminReaderRepository,
) => {
  return async (rawRefreshToken: string): Promise<RefreshResult | null> => {
    const tokenHash = createHash("sha256").update(rawRefreshToken).digest("hex");

    // Réclame (et révoque) atomiquement le token actif : deux refresh concurrents
    // ne peuvent pas passer tous les deux le contrôle et émettre des tokens — le
    // compare-and-swap ne laisse gagner qu'un seul appel.
    const stored = await refreshTokenRepo.claimByTokenHash(tokenHash);
    if (!stored) {
      // Le token n'est pas actif. S'il a existé (désormais révoqué), c'est un
      // replay d'un token déjà tourné → on traite ça comme un vol et on révoque
      // uniquement la famille de cette session. Limiter à la famille (et non à tout
      // l'utilisateur) garde ses autres appareils connectés — tout révoquer
      // laisserait un token périmé sur un appareil déconnecter le compte partout.
      const seen = await refreshTokenRepo.findByTokenHash(tokenHash);
      if (seen) {
        if (seen.sessionId) await refreshTokenRepo.revokeBySessionId(seen.sessionId);
        else await refreshTokenRepo.revokeAllForUser(seen.userId);
      }
      return null;
    }

    // Contrôle d'expiration — le claim l'a déjà révoqué, inutile de re-révoquer ici.
    if (new Date(stored.expiresAt) < new Date()) {
      return null;
    }

    // Relit l'utilisateur pour des claims frais — y compris la relation
    // administrateur de quartier, afin qu'une promotion/rétrogradation prenne
    // effet dès le prochain refresh.
    const user = await userReader.findById(stored.userId);
    if (!user) return null;

    // Les sessions d'un utilisateur banni sont mortes : on révoque toute la famille
    // et on refuse d'émettre un nouveau token (l'appelant efface les cookies et
    // renvoie 401), complétant le blocage entamé côté api.
    if (user.banned) {
      await refreshTokenRepo.revokeAllForUser(user.id);
      return null;
    }

    const adminDistrictId = await lookupAdminDistrictId(user, districtAdminReader);
    const accessToken = await signAccessToken(user, adminDistrictId);

    // Émet un nouveau refresh token (64 octets aléatoires, stocké en sha256).
    const newRawRefreshToken = randomBytes(64).toString("hex");
    const newTokenHash = createHash("sha256").update(newRawRefreshToken).digest("hex");

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    await refreshTokenRepo.create({
      userId: stored.userId,
      tokenHash: newTokenHash,
      expiresAt: expiresAt.toISOString(),
      expiresAtDate: expiresAt,
      revokedAt: null,
      // Conserve l'identité/origine de la session à travers la rotation ; seul
      // lastUsedAt change.
      createdAt: stored.createdAt,
      sessionId: stored.sessionId,
      userAgent: stored.userAgent,
      ip: stored.ip,
      lastUsedAt: now.toISOString(),
    });

    return { accessToken, refreshToken: newRawRefreshToken };
  };
};
