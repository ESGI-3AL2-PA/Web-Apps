/**
 * Router ts-rest de l'auth-service : implémente `authContract`.
 *
 * Couche router — chaque handler résout ses dépendances via `resolve(...)`, appelle
 * le cas d'usage correspondant et traduit son résultat en réponse HTTP typée.
 *
 * Couvre tout le cycle de vie de la session : login (avec MFA / enrôlement TOTP forcé),
 * refresh et logout (protégés par un CSRF double-submit), l'inscription et la
 * vérification d'e-mail, la réinitialisation de mot de passe, la gestion des sessions
 * actives, l'enrôlement/désactivation TOTP et le step-up.
 *
 * Le refresh token voyage dans un cookie httpOnly scellé au chemin /auth ; le token
 * CSRF l'accompagne dans un cookie jumeau lisible par le SPA.
 */
import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { initServer } from "@ts-rest/express";
import { jwtVerify } from "jose";
import type { Request } from "express";
import { authContract } from "@repo/contracts";
import { TOKEN_ISSUER, TOKEN_AUDIENCE_STEP_UP } from "@repo/shared";
import { resolve } from "../../repositories/container.js";
import { getPublicKey } from "../../keys.js";
import { loginUseCase } from "../../use-cases/login.use-case.js";
import { loginMfaUseCase } from "../../use-cases/login-mfa.use-case.js";
import { loginEnrollStartUseCase } from "../../use-cases/login-enroll-start.use-case.js";
import { loginEnrollConfirmUseCase } from "../../use-cases/login-enroll-confirm.use-case.js";
import { stepUpUseCase } from "../../use-cases/step-up.use-case.js";
import { refreshUseCase } from "../../use-cases/refresh.use-case.js";
import { logoutUseCase } from "../../use-cases/logout.use-case.js";
import { userinfoUseCase } from "../../use-cases/userinfo.use-case.js";
import { registerUseCase } from "../../use-cases/register.use-case.js";
import { verifyEmailUseCase } from "../../use-cases/verify-email.use-case.js";
import { resendVerificationUseCase } from "../../use-cases/resend-verification.use-case.js";
import { forgotPasswordUseCase } from "../../use-cases/forgot-password.use-case.js";
import { resetPasswordUseCase } from "../../use-cases/reset-password.use-case.js";
import { enrollTotpUseCase } from "../../use-cases/enroll-totp.use-case.js";
import { confirmTotpUseCase } from "../../use-cases/confirm-totp.use-case.js";
import { disableTotpUseCase } from "../../use-cases/disable-totp.use-case.js";
import { listSessionsUseCase } from "../../use-cases/list-sessions.use-case.js";
import { revokeSessionUseCase } from "../../use-cases/revoke-session.use-case.js";
import { revokeOtherSessionsUseCase } from "../../use-cases/revoke-other-sessions.use-case.js";

const REFRESH_COOKIE = "refresh_token";
const CSRF_COOKIE = "csrf_token";
const CSRF_HEADER = "x-csrf-token";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 jours
  path: "/auth",
};

// Paire double-submit : le cookie est renvoyé automatiquement par le navigateur ; le
// SPA récupère le token via GET /auth/csrf et le réémet dans X-CSRF-Token. Reprend les
// attributs du cookie de refresh (même path/sameSite/httpOnly) pour qu'ils voyagent
// ensemble — conservés en spread pour qu'ils ne puissent pas diverger.
const CSRF_COOKIE_OPTIONS = { ...COOKIE_OPTIONS };

const generateCsrf = () => randomBytes(32).toString("hex");

// Origine de la session capturée au login et stockée sur le refresh token.
const sessionContext = (req: Request) => ({
  userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"].slice(0, 400) : null,
  ip: req.ip ?? null,
});

// sha256 du propre cookie de refresh de l'appelant (présent sur les chemins /auth),
// utilisé pour marquer / exempter la session à l'origine de la requête. Null en
// l'absence de cookie.
const currentSessionHash = (req: Request): string | null => {
  const raw = req.cookies?.[REFRESH_COOKIE];
  return typeof raw === "string" ? createHash("sha256").update(raw).digest("hex") : null;
};

// Compare cookie et en-tête à temps constant (timingSafeEqual) pour éviter une fuite
// d'information par timing. Exige des longueurs identiques, sinon timingSafeEqual jette.
const csrfValid = (cookieToken: unknown, headerToken: unknown): boolean => {
  if (typeof cookieToken !== "string" || typeof headerToken !== "string") return false;
  if (cookieToken.length === 0 || cookieToken.length !== headerToken.length) return false;
  return timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken));
};

// Vérifie un access token Bearer sur les requêtes où l'auth-service est lui-même la
// ressource (les endpoints d'enrôlement TOTP). N'accepte que les tokens émis pour
// l'audience « api ». Retourne le `sub` (id utilisateur) ou null si invalide.
const verifyBearer = async (req: Request): Promise<string | null> => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  try {
    const { payload } = await jwtVerify(header.slice(7), getPublicKey(), {
      algorithms: ["RS256"],
      issuer: "auth-service",
      audience: "api",
    });
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
};

// Valide le X-Step-Up-Token émis par /auth/step-up pour le même utilisateur. Appliqué
// uniquement en production — en dev, les opérations sensibles de l'auth-service
// (désactivation TOTP) restent sans friction.
const STEP_UP_HEADER = "x-step-up-token";
const hasValidStepUp = async (req: Request, userId: string): Promise<boolean> => {
  if (process.env.NODE_ENV !== "production") return true;
  const raw = req.headers[STEP_UP_HEADER];
  const token = typeof raw === "string" ? raw : null;
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, getPublicKey(), {
      algorithms: ["RS256"],
      issuer: TOKEN_ISSUER,
      audience: TOKEN_AUDIENCE_STEP_UP,
    });
    return payload.sub === userId;
  } catch {
    return false;
  }
};

const s = initServer();

export const authRouter = s.router(authContract, {
  // POST /auth/login — vérifie identifiants + statut du compte, puis pose les cookies.
  // Peut court-circuiter en 202 quand une étape supplémentaire est requise :
  // mfa-required (code TOTP attendu) ou enrollment-required (enrôlement TOTP forcé).
  login: async ({ body, req, res }) => {
    const result = await loginUseCase(
      resolve("userReader"),
      resolve("refreshToken"),
      resolve("districtAdmin"),
    )(
      {
        email: body.email,
        password: body.password,
      },
      sessionContext(req),
    );

    if (result.kind === "invalid-credentials") {
      return { status: 401 as const, body: { message: "Invalid email or password" } };
    }
    if (result.kind === "banned") {
      return { status: 403 as const, body: { message: "This account has been suspended." } };
    }
    if (result.kind === "email-not-verified") {
      return {
        status: 403 as const,
        body: { message: "Email not verified — check your inbox", code: "email_not_verified" as const },
      };
    }
    if (result.kind === "mfa-required") {
      return { status: 202 as const, body: { mfa_required: true, mfa_token: result.mfaToken } };
    }
    if (result.kind === "enrollment-required") {
      return { status: 202 as const, body: { enrollment_required: true, enroll_token: result.enrollToken } };
    }

    const csrfToken = generateCsrf();
    res.cookie(REFRESH_COOKIE, result.refreshToken, COOKIE_OPTIONS);
    res.cookie(CSRF_COOKIE, csrfToken, CSRF_COOKIE_OPTIONS);

    return {
      status: 200 as const,
      body: { access_token: result.accessToken, csrf_token: csrfToken, user: result.user },
    };
  },

  // POST /auth/login/enroll/start — démarre l'enrôlement TOTP forcé pendant le login
  // (jeton d'enrôlement court obtenu du 202 enrollment-required). Renvoie l'URL otpauth
  // et le secret à afficher/scanner.
  loginEnrollStart: async ({ body }) => {
    const result = await loginEnrollStartUseCase(resolve("userReader"))(body.enroll_token);
    if (result.kind === "invalid-token") {
      return { status: 401 as const, body: { message: "Invalid or expired enrollment session" } };
    }
    if (result.kind === "already-enabled") {
      // Déjà enrôlé : la cérémonie ne s'applique plus — se reconnecter normalement.
      return { status: 401 as const, body: { message: "TOTP already enabled — sign in again" } };
    }
    return { status: 200 as const, body: { otpauth_url: result.otpauthUrl, secret: result.secret } };
  },

  // POST /auth/login/enroll/confirm — confirme le premier code TOTP et termine le login :
  // active le TOTP puis pose cookies + access token comme un login réussi.
  loginEnrollConfirm: async ({ body, req, res }) => {
    const result = await loginEnrollConfirmUseCase(
      resolve("userReader"),
      resolve("refreshToken"),
      resolve("districtAdmin"),
    )(body.enroll_token, body.code, sessionContext(req));
    if (result.kind === "invalid-code") {
      return { status: 400 as const, body: { message: "Invalid TOTP code" } };
    }
    if (result.kind !== "ok") {
      return { status: 401 as const, body: { message: "Invalid or expired enrollment session" } };
    }
    const csrfToken = generateCsrf();
    res.cookie(REFRESH_COOKIE, result.refreshToken, COOKIE_OPTIONS);
    res.cookie(CSRF_COOKIE, csrfToken, CSRF_COOKIE_OPTIONS);
    return {
      status: 200 as const,
      body: { access_token: result.accessToken, csrf_token: csrfToken, user: result.user },
    };
  },

  // POST /auth/login/mfa — deuxième étape d'un login MFA : échange le mfa_token + code
  // TOTP contre une session complète (cookies + access token).
  loginMfa: async ({ body, req, res }) => {
    const result = await loginMfaUseCase(resolve("userReader"), resolve("refreshToken"), resolve("districtAdmin"))(
      body.mfa_token,
      body.code,
      sessionContext(req),
    );
    if (result.kind !== "ok") {
      return { status: 401 as const, body: { message: "MFA verification failed" } };
    }
    const csrfToken = generateCsrf();
    res.cookie(REFRESH_COOKIE, result.refreshToken, COOKIE_OPTIONS);
    res.cookie(CSRF_COOKIE, csrfToken, CSRF_COOKIE_OPTIONS);
    return {
      status: 200 as const,
      body: { access_token: result.accessToken, csrf_token: csrfToken, user: result.user },
    };
  },

  // POST /auth/refresh — fait tourner le refresh token et émet un nouvel access token.
  // Protégé par le CSRF double-submit ; à l'échec de validation du refresh token les
  // deux cookies sont effacés. Le refresh token est renouvelé (rotation) à chaque appel.
  refresh: async ({ req, res }) => {
    const cookieCsrf = req.cookies?.[CSRF_COOKIE];
    const headerCsrf = req.headers[CSRF_HEADER];
    if (!csrfValid(cookieCsrf, headerCsrf)) {
      return { status: 403 as const, body: { message: "Invalid CSRF token" } };
    }

    const rawToken = req.cookies?.[REFRESH_COOKIE];
    if (!rawToken) {
      return { status: 401 as const, body: { message: "No refresh token" } };
    }

    const result = await refreshUseCase(
      resolve("refreshToken"),
      resolve("userReader"),
      resolve("districtAdmin"),
    )(rawToken);

    if (!result) {
      res.clearCookie(REFRESH_COOKIE, { path: "/auth" });
      res.clearCookie(CSRF_COOKIE, { path: "/auth" });
      return { status: 401 as const, body: { message: "Invalid or expired refresh token" } };
    }

    const newCsrf = generateCsrf();
    res.cookie(REFRESH_COOKIE, result.refreshToken, COOKIE_OPTIONS);
    res.cookie(CSRF_COOKIE, newCsrf, CSRF_COOKIE_OPTIONS);

    return { status: 200 as const, body: { access_token: result.accessToken, csrf_token: newCsrf } };
  },

  // POST /auth/logout — révoque le refresh token courant côté serveur et efface les
  // cookies. Protégé par CSRF. Idempotent : réussit même sans cookie de refresh.
  logout: async ({ req, res }) => {
    const cookieCsrf = req.cookies?.[CSRF_COOKIE];
    const headerCsrf = req.headers[CSRF_HEADER];
    if (!csrfValid(cookieCsrf, headerCsrf)) {
      return { status: 403 as const, body: { message: "Invalid CSRF token" } };
    }

    const rawToken = req.cookies?.[REFRESH_COOKIE];
    if (rawToken) {
      await logoutUseCase(resolve("refreshToken"))(rawToken);
    }

    res.clearCookie(REFRESH_COOKIE, { path: "/auth" });
    res.clearCookie(CSRF_COOKIE, { path: "/auth" });

    return { status: 200 as const, body: { success: true } };
  },

  // POST /auth/register — crée le compte (via l'api, cf. flux d'inscription) et envoie
  // l'e-mail de vérification. La langue de l'e-mail suit l'en-tête Accept-Language.
  // Répond 202 sans révéler si l'e-mail existe déjà, sauf collision explicite (409).
  register: async ({ body, req }) => {
    const result = await registerUseCase(resolve("userReader"), resolve("authToken"))(
      body,
      req.headers["accept-language"],
    );

    if (result === "email-taken") {
      return { status: 409 as const, body: { message: "Email already in use" } };
    }

    return {
      status: 202 as const,
      body: { message: "Account created — check your email to verify before logging in" },
    };
  },

  // GET /auth/verify-email?token=… — consomme le jeton de vérification et marque
  // l'e-mail comme vérifié. Distingue lien expiré / utilisateur introuvable / invalide.
  verifyEmail: async ({ query }) => {
    const result = await verifyEmailUseCase(resolve("authToken"), resolve("userReader"))(query.token);
    if (result === "ok") {
      return { status: 200 as const, body: { message: "Email verified — you can now log in" } };
    }
    if (result === "expired") {
      return { status: 400 as const, body: { message: "Verification link expired — request a new one" } };
    }
    if (result === "user-not-found") {
      return { status: 404 as const, body: { message: "User not found" } };
    }
    return { status: 400 as const, body: { message: "Invalid verification link" } };
  },

  // POST /auth/resend-verification — renvoie un lien de vérification. Réponse toujours
  // 200 et neutre (ne divulgue pas si l'e-mail est enregistré / déjà vérifié).
  resendVerification: async ({ body }) => {
    await resendVerificationUseCase(resolve("userReader"), resolve("authToken"))(body.email);
    return {
      status: 200 as const,
      body: { message: "If that email is registered and unverified, a new link has been sent" },
    };
  },

  // POST /auth/forgot-password — envoie un lien de réinitialisation. Réponse toujours
  // 200 et neutre pour ne pas révéler l'existence du compte (énumération d'e-mails).
  forgotPassword: async ({ body }) => {
    await forgotPasswordUseCase(resolve("userReader"), resolve("authToken"))(body.email);
    return {
      status: 200 as const,
      body: { message: "If that email is registered, a password reset link has been sent" },
    };
  },

  // POST /auth/reset-password — définit un nouveau mot de passe à partir du jeton de
  // réinitialisation et révoque toutes les sessions existantes de l'utilisateur.
  resetPassword: async ({ body }) => {
    const result = await resetPasswordUseCase(
      resolve("authToken"),
      resolve("userReader"),
      resolve("refreshToken"),
    )(body.token, body.newPassword);
    if (result === "ok") {
      return { status: 200 as const, body: { message: "Password updated — sign in with the new password" } };
    }
    if (result === "expired") {
      return { status: 400 as const, body: { message: "Reset link expired — request a new one" } };
    }
    if (result === "user-not-found") {
      return { status: 404 as const, body: { message: "User not found" } };
    }
    return { status: 400 as const, body: { message: "Invalid reset link" } };
  },

  // GET /auth/userinfo — renvoie le profil de l'utilisateur porté par l'access token
  // Bearer (endpoint de type OIDC userinfo).
  userinfo: async ({ req }) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return { status: 401 as const, body: { message: "Missing Bearer token" } };
    }

    const token = authHeader.slice(7);

    try {
      const user = await userinfoUseCase(resolve("userReader"))(token);
      if (!user) {
        return { status: 401 as const, body: { message: "User not found" } };
      }
      return { status: 200 as const, body: user };
    } catch {
      return { status: 401 as const, body: { message: "Invalid or expired token" } };
    }
  },

  // GET /auth/csrf — renvoie au SPA la valeur du cookie CSRF courant pour qu'il la
  // réémette dans l'en-tête X-CSRF-Token (mécanisme double-submit).
  csrf: async ({ req }) => {
    const token = req.cookies?.[CSRF_COOKIE];
    return { status: 200 as const, body: { csrf_token: typeof token === "string" ? token : "" } };
  },

  // GET /auth/sessions — liste les sessions (refresh tokens actifs) de l'utilisateur ;
  // marque celle à l'origine de la requête via son hash. Protégé par access token Bearer.
  sessions: async ({ req }) => {
    const userId = await verifyBearer(req);
    if (!userId) {
      return { status: 401 as const, body: { message: "Missing or invalid access token" } };
    }
    const sessions = await listSessionsUseCase(resolve("refreshToken"))(userId, currentSessionHash(req));
    return { status: 200 as const, body: sessions };
  },

  // DELETE /auth/sessions/:id — révoque une session précise de l'utilisateur (déconnexion
  // à distance d'un autre appareil). 404 si la session n'appartient pas à l'appelant.
  revokeSession: async ({ req, params }) => {
    const userId = await verifyBearer(req);
    if (!userId) {
      return { status: 401 as const, body: { message: "Missing or invalid access token" } };
    }
    const revoked = await revokeSessionUseCase(resolve("refreshToken"))(userId, params.id);
    if (!revoked) {
      return { status: 404 as const, body: { message: "Session not found" } };
    }
    return { status: 200 as const, body: { message: "Session revoked" } };
  },

  // POST /auth/sessions/revoke-others — révoque toutes les sessions SAUF celle de
  // l'appelant (identifiée par son hash), pour un « déconnecter partout ailleurs ».
  revokeOtherSessions: async ({ req }) => {
    const userId = await verifyBearer(req);
    if (!userId) {
      return { status: 401 as const, body: { message: "Missing or invalid access token" } };
    }
    await revokeOtherSessionsUseCase(resolve("refreshToken"))(userId, currentSessionHash(req));
    return { status: 200 as const, body: { message: "Other sessions revoked" } };
  },

  // POST /auth/totp/enroll — démarre l'enrôlement TOTP volontaire pour un utilisateur
  // déjà connecté. Renvoie l'URL otpauth + le secret ; le TOTP reste inactif jusqu'à
  // /auth/totp/confirm. 409 si le TOTP est déjà activé.
  totpEnroll: async ({ req }) => {
    const userId = await verifyBearer(req);
    if (!userId) {
      return { status: 401 as const, body: { message: "Missing or invalid access token" } };
    }
    const result = await enrollTotpUseCase(resolve("userReader"))(userId);
    if (result.kind === "user-not-found") {
      return { status: 401 as const, body: { message: "User not found" } };
    }
    if (result.kind === "already-enabled") {
      return { status: 409 as const, body: { message: "TOTP already enabled — disable it first" } };
    }
    return { status: 200 as const, body: { otpauth_url: result.otpauthUrl, secret: result.secret } };
  },

  // POST /auth/totp/confirm — confirme le premier code TOTP et active le TOTP sur le
  // compte. no-enrollment si aucun secret en attente n'a été généré au préalable.
  totpConfirm: async ({ req, body }) => {
    const userId = await verifyBearer(req);
    if (!userId) {
      return { status: 401 as const, body: { message: "Missing or invalid access token" } };
    }
    const result = await confirmTotpUseCase(resolve("userReader"))(userId, body.code);
    if (result === "ok") {
      return { status: 200 as const, body: { message: "TOTP enabled" } };
    }
    if (result === "invalid-code") {
      return { status: 400 as const, body: { message: "Invalid TOTP code" } };
    }
    if (result === "no-enrollment") {
      return { status: 400 as const, body: { message: "No pending TOTP enrollment — call /auth/totp/enroll first" } };
    }
    return { status: 401 as const, body: { message: "User not found" } };
  },

  // POST /auth/totp/disable — désactive le TOTP. Exige à la fois le mot de passe et,
  // en production, un step-up récent (voir ci-dessous).
  totpDisable: async ({ req, body }) => {
    const userId = await verifyBearer(req);
    if (!userId) {
      return { status: 401 as const, body: { message: "Missing or invalid access token" } };
    }
    // Désactiver la MFA est le downgrade de sécurité le plus sensible : en production on
    // exige un code frais (step-up) EN PLUS du mot de passe, pour qu'un access token volé
    // seul ne suffise pas à la retirer.
    if (!(await hasValidStepUp(req, userId))) {
      return { status: 401 as const, body: { message: "Step-up verification required", code: "step_up_required" } };
    }
    const result = await disableTotpUseCase(resolve("userReader"))(userId, body.password);
    if (result === "ok") {
      return { status: 200 as const, body: { message: "TOTP disabled" } };
    }
    return { status: 401 as const, body: { message: "Wrong password or user not found" } };
  },

  // POST /auth/step-up — ré-authentification forte : échange un code TOTP frais contre
  // un step-up token de courte durée, requis pour les opérations les plus sensibles.
  stepUp: async ({ req, body }) => {
    const userId = await verifyBearer(req);
    if (!userId) {
      return { status: 401 as const, body: { message: "Missing or invalid access token" } };
    }
    const result = await stepUpUseCase(resolve("userReader"))(userId, body.code);
    if (result.kind !== "ok") {
      return { status: 401 as const, body: { message: "Invalid code or TOTP not enabled" } };
    }
    return { status: 200 as const, body: { step_up_token: result.stepUpToken } };
  },
});
