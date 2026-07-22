import type { RequestHandler } from "express";
import type { AppRoute } from "@ts-rest/core";
import { jwtVerify } from "jose";
import { getAuthPolicy } from "@repo/contracts";
import { TOKEN_ISSUER, TOKEN_ALG, TOKEN_AUDIENCE_STEP_UP } from "@repo/shared";
import { JWKS } from "./auth.middleware.js";

const STEP_UP_HEADER = "x-step-up-token";

/**
 * Enforces a fresh-TOTP step-up on sensitive operations, driven by the contract's
 * `metadata.auth.stepUp` policy — the same declarative pattern as `authorize`. A stolen
 * live access token is not enough for these; the caller must present an `X-Step-Up-Token`
 * minted moments ago at /auth/step-up (proving a fresh code).
 *
 * Production-only: in dev this short-circuits so MFA stays fully optional locally. Runs
 * after `authorize`, so `req.user` (and audience/ownership) is already established.
 */
export const requireStepUp: RequestHandler = async (req, res, next) => {
  const route = (req as { tsRestRoute?: AppRoute }).tsRestRoute;
  const stepUp = route ? getAuthPolicy(route)?.stepUp : undefined;
  if (!stepUp) return next();

  // Dev/local: never require step-up — the endpoints exist but enforcement is prod-only.
  if (process.env.NODE_ENV !== "production") return next();

  const body = (req.body ?? {}) as Record<string, unknown>;
  const applies =
    stepUp.always === true || (stepUp.whenBodyTouches?.some((field) => body[field] !== undefined) ?? false);
  if (!applies) return next();

  const raw = req.headers[STEP_UP_HEADER];
  const token = typeof raw === "string" ? raw : null;
  if (!token) {
    res.status(401).json({ message: "Step-up verification required", code: "step_up_required" });
    return;
  }

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      algorithms: [TOKEN_ALG],
      issuer: TOKEN_ISSUER,
      audience: TOKEN_AUDIENCE_STEP_UP,
    });
    if (payload.sub !== req.user?.sub) {
      res.status(401).json({ message: "Step-up token does not match the caller", code: "step_up_required" });
      return;
    }
  } catch {
    res.status(401).json({ message: "Invalid or expired step-up token", code: "step_up_required" });
    return;
  }

  next();
};
