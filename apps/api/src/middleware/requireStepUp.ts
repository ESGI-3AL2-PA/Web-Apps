import type { RequestHandler } from "express";
import type { AppRoute } from "@ts-rest/core";
import { jwtVerify } from "jose";
import { getAuthPolicy } from "@repo/contracts";
import { TOKEN_ISSUER, TOKEN_ALG, TOKEN_AUDIENCE_STEP_UP } from "@repo/shared";
import { JWKS } from "./auth.middleware.js";

// Middleware — step-up MFA. Impose une preuve de TOTP fraîche sur les opérations sensibles.

const STEP_UP_HEADER = "x-step-up-token";

/**
 * Impose un step-up TOTP frais sur les opérations sensibles, piloté par la politique
 * `metadata.auth.stepUp` du contrat — même approche déclarative que `authorize`. Un access token
 * live volé ne suffit pas ici ; l'appelant doit présenter un `X-Step-Up-Token` émis il y a quelques
 * instants sur /auth/step-up (prouvant un code frais).
 *
 * Prod uniquement : en dev, court-circuité pour que la MFA reste totalement optionnelle en local.
 * S'exécute après `authorize`, donc `req.user` (et audience/propriété) est déjà établi.
 */
export const requireStepUp: RequestHandler = async (req, res, next) => {
  const route = (req as { tsRestRoute?: AppRoute }).tsRestRoute;
  const stepUp = route ? getAuthPolicy(route)?.stepUp : undefined;
  if (!stepUp) return next();

  // Dev/local : ne jamais exiger de step-up — les endpoints existent mais l'application est prod-only.
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
