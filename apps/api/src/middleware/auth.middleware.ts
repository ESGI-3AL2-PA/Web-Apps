import { createRemoteJWKSet, jwtVerify } from "jose";
import type { RequestHandler } from "express";

const jwksUrl = process.env.AUTH_JWKS_URL ?? "http://localhost:3001/.well-known/jwks.json";
const JWKS = createRemoteJWKSet(new URL(jwksUrl));

const ISSUER = "auth-service";
const AUD_USER = "api";
const AUD_INTERNAL = "api:internal";

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
      algorithms: ["RS256"],
      issuer: ISSUER,
      audience: [AUD_USER, AUD_INTERNAL],
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

    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
};

export { requireAuth as default };
