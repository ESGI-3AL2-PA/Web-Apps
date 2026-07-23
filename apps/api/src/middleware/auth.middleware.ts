import { createRemoteJWKSet, jwtVerify } from "jose";
import type { RequestHandler } from "express";
import { TOKEN_ISSUER, TOKEN_ALG, TOKEN_AUDIENCE, TOKEN_AUDIENCE_INTERNAL } from "@repo/shared";
import { resolve } from "../repositories/container.js";
import type { IUserRepository } from "../repositories/User/user.repository.js";

// Middleware — authentification : vérifie le Bearer JWT contre le JWKS de l'auth-service et
// renseigne req.user. L'autorisation (rôles, propriété, quartier) est gérée ailleurs (authorize).

const jwksUrl = process.env.AUTH_JWKS_URL ?? "http://localhost:3001/.well-known/jwks.json";
// Exporté pour que `requireStepUp` valide les step-up tokens contre le même jeu de clés — un
// step-up token n'est qu'un autre JWT RS256 signé par l'auth-service, distingué par son audience.
export const JWKS = createRemoteJWKSet(new URL(jwksUrl));

export interface AuthUser {
  sub: string;
  email?: string;
  role: string;
  firstName?: string;
  lastName?: string;
  aud: string;
  /** Quartier que cet utilisateur administre (admin uniquement) ; injecté dans le token au login/refresh. */
  adminDistrictId?: string | null;
}

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthUser;
    /** Enregistrement chargé par le middleware authorize pour une vérification de propriété/quartier. */
    authRecord?: unknown;
  }
}

/**
 * Authentification uniquement : vérifie le JWT (signature/iss/aud) et renseigne req.user.
 * L'autorisation est prise en charge par le middleware `authorize` piloté par les métadonnées du contrat.
 */
export const requireAuth: RequestHandler = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ message: "Missing Bearer token" });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      algorithms: [TOKEN_ALG],
      issuer: TOKEN_ISSUER,
      audience: [TOKEN_AUDIENCE, TOKEN_AUDIENCE_INTERNAL],
    });

    req.user = {
      sub: payload.sub as string,
      email: payload.email as string | undefined,
      role: payload.role as string,
      firstName: payload.firstName as string | undefined,
      lastName: payload.lastName as string | undefined,
      aud: (Array.isArray(payload.aud) ? payload.aud[0] : payload.aud) as string,
      adminDistrictId: (payload.adminDistrictId as string | null | undefined) ?? null,
    };

    // Rejette immédiatement un token encore valide si le compte a été banni depuis. Seuls les
    // utilisateurs standards peuvent être bannis, donc on ne paie le lookup que pour les requêtes
    // `role: "user"` (le trafic admin/service n'est pas touché). Le login + refresh sont aussi
    // bloqués côté auth-service.
    if (req.user.role === "user") {
      const userRepo: IUserRepository = resolve("user");
      const user = await userRepo.getUserById(req.user.sub);
      if (user?.banned) {
        res.status(403).json({ message: "Account suspended" });
        return;
      }
    }

    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
};

export { requireAuth as default };
