import { Router, type Request, type Response } from "express";
import { DesktopAuthorizeQuerySchema, DesktopTokenRequestSchema } from "@repo/contracts";
import { resolve } from "../repositories/container.js";
import { DESKTOP_CLIENT_ID } from "../sso/client-registry.js";
import { isAllowedLoopbackRedirect } from "../sso/loopback-redirect.js";
import { desktopAuthorizeUseCase } from "../use-cases/desktop-authorize.use-case.js";
import { desktopTokenUseCase } from "../use-cases/desktop-token.use-case.js";

const REFRESH_COOKIE = "refresh_token";
const CSRF_COOKIE = "csrf_token";
const AUTH_PUBLIC_URL = process.env.AUTH_PUBLIC_URL ?? "http://localhost:3001";

/**
 * Authorization-code + PKCE login for the JavaFX desktop app (RFC 8252 native app).
 *
 * Plain Express rather than ts-rest: /authorize answers with a 302 and /token is
 * form-encoded. Both live under /auth/ because the refresh cookie is scoped to that
 * path — /authorize needs it to recognise an existing browser session.
 */
export const desktopSsoRouter = Router();

/**
 * Errors reach the client one of two ways (RFC 6749 §4.1.2.1). Before the redirect_uri
 * is known to be legitimate, they are rendered to the user-agent — redirecting to an
 * unvalidated URI is precisely the open redirect this flow must not become. Afterwards
 * they go back to the client as query parameters so the app can show a real message.
 */
const redirectError = (res: Response, redirectUri: string, error: string, state: string) => {
  const url = new URL(redirectUri);
  url.searchParams.set("error", error);
  url.searchParams.set("state", state);
  res.setHeader("Cache-Control", "no-store");
  res.redirect(url.href);
};

desktopSsoRouter.get("/auth/desktop/authorize", async (req: Request, res: Response) => {
  const parsed = DesktopAuthorizeQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_request", error_description: parsed.error.issues[0]?.message });
    return;
  }
  const query = parsed.data;

  // Client and redirect_uri are validated before anything can trigger a redirect.
  if (query.client_id !== DESKTOP_CLIENT_ID) {
    res.status(400).json({ error: "invalid_client" });
    return;
  }
  if (!isAllowedLoopbackRedirect(query.redirect_uri)) {
    res
      .status(400)
      .json({ error: "invalid_request", error_description: "redirect_uri is not an allowed loopback callback" });
    return;
  }

  const authorize = desktopAuthorizeUseCase(
    resolve("authorizationCode"),
    resolve("refreshToken"),
    resolve("userReader"),
  );

  const outcome = await authorize({
    rawRefreshToken: typeof req.cookies?.[REFRESH_COOKIE] === "string" ? req.cookies[REFRESH_COOKIE] : null,
    redirectUri: query.redirect_uri,
    codeChallenge: query.code_challenge,
    forceReauth: query.prompt === "login",
  });

  if (outcome.status === "unauthenticated") {
    if (query.prompt === "login") {
      // The use-case revoked the session server-side; drop the browser's copy too,
      // otherwise the login page is reached with a cookie that no longer resolves.
      res.clearCookie(REFRESH_COOKIE, { path: "/auth" });
      res.clearCookie(CSRF_COOKIE, { path: "/auth" });
    }
    // Send them through the hosted login page, which returns here once the cookie
    // is set. Absolute + same-origin, which the page's safeRedirect already allows.
    const returnTo = new URL(req.originalUrl, AUTH_PUBLIC_URL);
    // Strip `prompt` from the return trip: leaving it in would force re-auth again
    // on the way back, looping the user between /login and /authorize forever.
    returnTo.searchParams.delete("prompt");
    res.redirect(`/login?redirect_uri=${encodeURIComponent(returnTo.href)}`);
    return;
  }

  if (outcome.status === "forbidden") {
    redirectError(res, query.redirect_uri, "access_denied", query.state);
    return;
  }

  const url = new URL(query.redirect_uri);
  url.searchParams.set("code", outcome.code);
  url.searchParams.set("state", query.state);
  res.setHeader("Cache-Control", "no-store");
  res.redirect(url.href);
});

desktopSsoRouter.post("/auth/desktop/token", async (req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");

  const parsed = DesktopTokenRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_request", error_description: parsed.error.issues[0]?.message });
    return;
  }
  const body = parsed.data;

  if (body.client_id !== DESKTOP_CLIENT_ID) {
    res.status(400).json({ error: "invalid_client" });
    return;
  }

  const exchange = desktopTokenUseCase(resolve("authorizationCode"), resolve("userReader"), resolve("districtAdmin"));

  const outcome = await exchange({
    code: body.code,
    redirectUri: body.redirect_uri,
    clientId: body.client_id,
    codeVerifier: body.code_verifier,
  });

  if (outcome.status === "invalid_grant") {
    res.status(400).json({ error: "invalid_grant" });
    return;
  }
  if (outcome.status === "access_denied") {
    res.status(403).json({ error: "access_denied", error_description: "this account is not an administrator" });
    return;
  }

  res.json({ access_token: outcome.accessToken, token_type: "Bearer", expires_in: outcome.expiresIn });
});
