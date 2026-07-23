import { jwtVerify } from "jose";
import { getPublicKey } from "../keys.js";
import type { IUserReaderRepository } from "../repositories/User/user-reader.repository.js";

/**
 * Cas d'usage : « userinfo » — profil de l'utilisateur à partir d'un access token.
 *
 * Vérifie l'access token puis renvoie le DTO utilisateur, expurgé des secrets, et
 * complété de l'adminDistrictId lu depuis le token.
 *
 * @returns Une fonction renvoyant le DTO utilisateur, ou `null` si le token ne
 *   porte pas de sujet ou si l'utilisateur est introuvable.
 */
export const userinfoUseCase = (userReader: IUserReaderRepository) => {
  return async (accessToken: string) => {
    // Restreint aux vrais access tokens — sans iss/aud, le token "mfa" pré-2FA (et
    // tout autre token signé par l'auth-service) serait accepté ici.
    const { payload } = await jwtVerify(accessToken, getPublicKey(), {
      algorithms: ["RS256"],
      issuer: "auth-service",
      audience: "api",
    });

    const userId = payload.sub;
    if (!userId) return null;

    const user = await userReader.findById(userId);
    if (!user) return null;

    // N'expose jamais le hash de mot de passe ni le secret TOTP.
    const { passwordHash: _passwordHash, totpSecret: _totpSecret, ...userDto } = user;
    // adminDistrictId vit sur le token (émis au login/refresh), pas sur
    // l'enregistrement utilisateur — on le remonte pour que l'admin front se
    // cadre sur le quartier que cet administrateur administre.
    return { ...userDto, adminDistrictId: (payload.adminDistrictId as string | null | undefined) ?? null };
  };
};
