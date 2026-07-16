import { createRemoteJWKSet, jwtVerify } from "jose";
import type { RequestHandler } from "express";
import { TOKEN_ISSUER, TOKEN_ALG, TOKEN_AUDIENCE, TOKEN_AUDIENCE_INTERNAL } from "@repo/shared";
import { resolve } from "../repositories/container.js";
import type { IUserRepository } from "../repositories/User/user.repository.js";

const jwksUrl = process.env.AUTH_JWKS_URL ?? "http://localhost:3001/.well-known/jwks.json";
const JWKS = createRemoteJWKSet(new URL(jwksUrl));

export interface AuthUser {
  sub: string;
  email?: string;
  role: string;
  firstName?: string;
  lastName?: string;
  aud: string;
  /** District this user administers (admin only); minted into the token at login/refresh. */
  adminDistrictId?: string | null;
}

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthUser;
    /** Record loaded by the authorize middleware for an ownership/district check. */
    authRecord?: unknown;
  }
}

// Authentication only: verifies the JWT (signature/iss/aud) and sets req.user.
// Authorization is handled by the contract-metadata-driven `authorize` middleware.
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

    // Immediately reject a still-valid token if the account has since been banned. Only regular
    // users can be banned, so we only pay the lookup for `role: "user"` requests (admin/service
    // traffic is untouched). Login + refresh are also blocked in auth-service.
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
