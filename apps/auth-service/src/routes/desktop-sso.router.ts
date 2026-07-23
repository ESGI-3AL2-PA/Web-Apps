import { Router, type Request, type Response } from "express";
import { DesktopAuthorizeQuerySchema, DesktopTokenRequestSchema } from "@repo/contracts";
import { resolve } from "../repositories/container.js";
import { DESKTOP_CLIENT_ID } from "../sso/client-registry.js";
import { isAllowedLoopbackRedirect } from "../sso/loopback-redirect.js";
import { desktopAuthorizeUseCase } from "../use-cases/desktop-authorize.use-case.js";
import { desktopTokenUseCase } from "../use-cases/desktop-token.use-case.js";

/**
 * Router SSO desktop de l'auth-service : les deux endpoints OAuth du flux
 * authorization-code + PKCE de l'app JavaFX admin (client public, admin/superAdmin
 * uniquement, imposé côté serveur).
 *
 * - GET  /auth/desktop/authorize : valide client_id + redirect_uri (loopback), résout
 *   la session navigateur, et redirige avec un code (ou vers la page de login).
 * - POST /auth/desktop/token     : échange le code + code_verifier PKCE contre un
 *   access token d'audience « api ».
 */

const REFRESH_COOKIE = "refresh_token";
const CSRF_COOKIE = "csrf_token";
const AUTH_PUBLIC_URL = process.env.AUTH_PUBLIC_URL ?? "http://localhost:3001";

/**
 * Login authorization-code + PKCE pour l'app desktop JavaFX (app native, RFC 8252).
 *
 * Express « brut » plutôt que ts-rest : /authorize répond en 302 et /token est
 * form-encoded. Les deux vivent sous /auth/ car le cookie de refresh est scellé à ce
 * chemin — /authorize en a besoin pour reconnaître une session navigateur existante.
 */
export const desktopSsoRouter = Router();

/**
 * Les erreurs remontent au client de deux façons (RFC 6749 §4.1.2.1). Tant que le
 * redirect_uri n'est pas confirmé légitime, elles sont rendues à l'user-agent —
 * rediriger vers une URI non validée serait précisément l'open redirect que ce flux
 * doit éviter de devenir. Une fois l'URI validée, elles repartent vers le client en
 * paramètres de requête pour que l'app affiche un vrai message.
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

  // client_id et redirect_uri sont validés avant que quoi que ce soit puisse déclencher
  // une redirection (protection contre l'open redirect).
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
      // Le cas d'usage a révoqué la session côté serveur ; on efface aussi la copie du
      // navigateur, sinon la page de login est atteinte avec un cookie qui ne résout plus.
      res.clearCookie(REFRESH_COOKIE, { path: "/auth" });
      res.clearCookie(CSRF_COOKIE, { path: "/auth" });
    }
    // On les fait passer par la page de login hébergée, qui revient ici une fois le
    // cookie posé. Absolue + same-origin, ce que le safeRedirect de la page autorise déjà.
    const returnTo = new URL(req.originalUrl, AUTH_PUBLIC_URL);
    // On retire `prompt` du trajet retour : le laisser forcerait une nouvelle
    // ré-authentification au retour, bouclant l'utilisateur entre /login et /authorize
    // à l'infini.
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
