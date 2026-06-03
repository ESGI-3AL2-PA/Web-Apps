import { createRemoteJWKSet, jwtVerify } from "jose";
import type { RequestHandler } from "express";

const jwksUrl = process.env.AUTH_JWKS_URL ?? "http://localhost:6000/.well-known/jwks.json";
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
}

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthUser;
  }
}

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
    };

    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
};

export const requireRole =
  (...roles: string[]): RequestHandler =>
  (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ message: "Insufficient permissions" });
      return;
    }
    next();
  };

export const requireAud =
  (aud: string): RequestHandler =>
  (req, res, next) => {
    if (req.user?.aud !== aud) {
      res.status(403).json({ message: "Wrong audience" });
      return;
    }
    next();
  };

const idFromPath = (path: string): string | null => {
  // path is what comes after the mount prefix, e.g. "/123" → "123"
  const seg = path.split("/").filter(Boolean)[0];
  return seg ?? null;
};

// /users access control:
//   GET    /         admin only
//   GET    /:id      admin or self
//   POST   /         service token (aud="api:internal") only
//   PATCH  /:id      admin or self
//   DELETE /:id      admin only
export const usersAccessControl: RequestHandler = (req, res, next) => {
  if (!req.user) {
    res.status(401).json({ message: "Unauthenticated" });
    return;
  }
  const id = idFromPath(req.path);
  const isAdmin = req.user.role === "admin";
  const isSelf = id !== null && req.user.sub === id;

  if (req.method === "POST" && (req.path === "/" || req.path === "")) {
    if (req.user.aud !== AUD_INTERNAL) {
      res.status(403).json({ message: "Internal service token required" });
      return;
    }
    return next();
  }
  // Every other /users operation is for end-user tokens only — internal service
  // tokens may *only* create users (the branch above).
  if (req.user.aud !== AUD_USER) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }
  if (req.method === "GET" && (req.path === "/" || req.path === "")) {
    if (!isAdmin) {
      res.status(403).json({ message: "Admin only" });
      return;
    }
    return next();
  }
  if ((req.method === "GET" || req.method === "PATCH") && id) {
    if (!isAdmin && !isSelf) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    return next();
  }
  if (req.method === "DELETE" && id) {
    if (!isAdmin) {
      res.status(403).json({ message: "Admin only" });
      return;
    }
    return next();
  }
  next();
};

// Reads (GET) allowed for any end-user token; writes require one of `roles`.
// Rejects internal service tokens outright.
const userReadsRoleWrites =
  (...roles: string[]): RequestHandler =>
  (req, res, next) => {
    if (!req.user) {
      res.status(401).json({ message: "Unauthenticated" });
      return;
    }
    if (req.user.aud !== AUD_USER) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    if (req.method === "GET") return next();
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ message: "Insufficient permissions" });
      return;
    }
    next();
  };

// Rejects internal service tokens; otherwise lets the handler do ownership checks.
const endUserOnly: RequestHandler = (req, res, next) => {
  if (!req.user) {
    res.status(401).json({ message: "Unauthenticated" });
    return;
  }
  if (req.user.aud !== AUD_USER) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }
  next();
};

// /districts and /tags: reads any auth, writes admin only.
export const districtsAccessControl = userReadsRoleWrites("admin");
export const tagsAccessControl = userReadsRoleWrites("admin");

// Resources where every operation needs a real end user and per-record
// ownership is enforced in the handler (needs a DB read).
export const listingsAccessControl = endUserOnly;
export const eventsAccessControl = endUserOnly;
export const votesAccessControl = endUserOnly;
export const incidentsAccessControl = endUserOnly;
export const conversationsAccessControl = endUserOnly;
export const notificationsAccessControl = endUserOnly;
export const transactionsAccessControl = endUserOnly;
export const contractsAccessControl = endUserOnly;

// Convenience: allow access if requireAuth succeeded — kept for legacy parity.
export { requireAuth as default };
