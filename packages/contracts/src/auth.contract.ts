import { initContract } from "@ts-rest/core";

import {
  LoginRequestDtoSchema,
  LoginResponseDtoSchema,
  RefreshResponseDtoSchema,
  LogoutResponseDtoSchema,
  UnauthorizedErrorSchema,
  ForbiddenErrorSchema,
  ConflictErrorSchema,
  RegisterRequestDtoSchema,
  UserResponseDtoSchema,
  CsrfResponseDtoSchema,
  AuthMessageResponseDtoSchema,
  VerifyEmailQuerySchema,
  ResendVerificationRequestSchema,
  ForgotPasswordRequestSchema,
  ResetPasswordRequestSchema,
  LoginChallengeResponseSchema,
  LoginMfaRequestSchema,
  StepUpRequestSchema,
  StepUpResponseSchema,
  TotpEnrollResponseSchema,
  TotpCodeRequestSchema,
  TotpDisableRequestSchema,
  EnrollStartRequestSchema,
  EnrollConfirmRequestSchema,
  SessionListResponseDtoSchema,
  SessionParamsDtoSchema,
} from "./DTO";

const c = initContract();

// Contrat ts-rest de l'auth-service (port 3001) : source de vérité des routes /auth.
// Couvre la connexion (avec MFA/enrôlement TOTP obligatoire), la rotation des tokens
// (refresh/logout protégés par CSRF), l'inscription + vérification d'email, le reset
// de mot de passe, la gestion des sessions, l'enrôlement/désactivation TOTP et le
// step-up. Chaque route déclare son `summary` (visible dans l'OpenAPI) et ses codes.
export const authContract = c.router({
  // POST /auth/login — public. Valide les identifiants ; 200 = tokens, 202 = MFA ou
  // enrôlement requis, 403 = email non vérifié.
  login: {
    method: "POST",
    path: "/auth/login",
    body: LoginRequestDtoSchema,
    responses: {
      200: LoginResponseDtoSchema,
      202: LoginChallengeResponseSchema,
      401: UnauthorizedErrorSchema,
      403: ForbiddenErrorSchema,
    },
    summary: "Validate credentials. 200 → tokens; 202 → MFA required or enrollment required; 403 → email not verified.",
  },

  // POST /auth/login/mfa — public. Finalise la connexion MFA : échange mfa_token +
  // code TOTP contre les vrais tokens.
  loginMfa: {
    method: "POST",
    path: "/auth/login/mfa",
    body: LoginMfaRequestSchema,
    responses: {
      200: LoginResponseDtoSchema,
      401: UnauthorizedErrorSchema,
    },
    summary: "Complete MFA login: exchange mfa_token + TOTP code for the real tokens.",
  },

  // POST /auth/login/enroll/start — public. Enrôlement TOTP obligatoire : échange
  // enroll_token contre l'URL otpauth + le secret à encoder en QR code.
  loginEnrollStart: {
    method: "POST",
    path: "/auth/login/enroll/start",
    body: EnrollStartRequestSchema,
    responses: {
      200: TotpEnrollResponseSchema,
      401: UnauthorizedErrorSchema,
    },
    summary: "Mandatory-enrollment ceremony: exchange enroll_token for the otpauth URL + secret.",
  },

  // POST /auth/login/enroll/confirm — public. Vérifie le premier code TOTP, bascule
  // totpEnabled et émet les vrais tokens.
  loginEnrollConfirm: {
    method: "POST",
    path: "/auth/login/enroll/confirm",
    body: EnrollConfirmRequestSchema,
    responses: {
      200: LoginResponseDtoSchema,
      400: AuthMessageResponseDtoSchema,
      401: UnauthorizedErrorSchema,
    },
    summary: "Mandatory-enrollment ceremony: verify the first code, flip totpEnabled, and issue the real tokens.",
  },

  // POST /auth/refresh — cookie refresh + X-CSRF-Token. Rotation du refresh token et
  // émission d'un nouvel access token.
  refresh: {
    method: "POST",
    path: "/auth/refresh",
    body: c.noBody(),
    responses: {
      200: RefreshResponseDtoSchema,
      401: UnauthorizedErrorSchema,
      403: ForbiddenErrorSchema,
    },
    summary: "Rotate refresh token and issue new access token (requires X-CSRF-Token)",
  },

  // POST /auth/logout — X-CSRF-Token. Révoque le refresh token et efface le cookie.
  logout: {
    method: "POST",
    path: "/auth/logout",
    body: c.noBody(),
    responses: {
      200: LogoutResponseDtoSchema,
      403: ForbiddenErrorSchema,
    },
    summary: "Revoke refresh token and clear cookie (requires X-CSRF-Token)",
  },

  // GET /auth/csrf — bootstrap. Renvoie le token CSRF du cookie pour les SPA
  // cross-origin.
  csrf: {
    method: "GET",
    path: "/auth/csrf",
    responses: {
      200: CsrfResponseDtoSchema,
    },
    summary: "Bootstrap: return the CSRF token from the cookie for cross-origin SPAs",
  },

  // GET /auth/userinfo — Bearer. Renvoie les claims de l'utilisateur depuis l'access
  // token.
  userinfo: {
    method: "GET",
    path: "/auth/userinfo",
    responses: {
      200: UserResponseDtoSchema,
      401: UnauthorizedErrorSchema,
    },
    summary: "Return user claims from Bearer access token",
  },

  // POST /auth/register — public. Crée un utilisateur et envoie un lien de
  // vérification par email ; aucun token émis avant vérification.
  register: {
    method: "POST",
    path: "/auth/register",
    body: RegisterRequestDtoSchema,
    responses: {
      202: AuthMessageResponseDtoSchema,
      400: AuthMessageResponseDtoSchema,
      409: ConflictErrorSchema,
    },
    summary: "Register a new user and email a verification link. No tokens are issued until verified.",
  },

  // GET /auth/verify — public. Marque l'email comme vérifié via le token du lien.
  verifyEmail: {
    method: "GET",
    path: "/auth/verify",
    query: VerifyEmailQuerySchema,
    responses: {
      200: AuthMessageResponseDtoSchema,
      400: AuthMessageResponseDtoSchema,
      404: AuthMessageResponseDtoSchema,
    },
    summary: "Mark email verified using the token from the verification link",
  },

  // POST /auth/resend-verification — public. Renvoie l'email de vérification ;
  // toujours 200 (pas d'énumération d'utilisateurs).
  resendVerification: {
    method: "POST",
    path: "/auth/resend-verification",
    body: ResendVerificationRequestSchema,
    responses: {
      200: AuthMessageResponseDtoSchema,
    },
    summary: "Resend the verification email (always 200 — no user enumeration)",
  },

  // POST /auth/forgot-password — public. Envoie un lien de réinitialisation à usage
  // unique ; toujours 200 (pas d'énumération d'utilisateurs).
  forgotPassword: {
    method: "POST",
    path: "/auth/forgot-password",
    body: ForgotPasswordRequestSchema,
    responses: {
      200: AuthMessageResponseDtoSchema,
    },
    summary: "Email a one-shot password reset link (always 200 — no user enumeration)",
  },

  // POST /auth/reset-password — public. Définit un nouveau mot de passe via le token
  // du lien et révoque toutes les sessions.
  resetPassword: {
    method: "POST",
    path: "/auth/reset-password",
    body: ResetPasswordRequestSchema,
    responses: {
      200: AuthMessageResponseDtoSchema,
      400: AuthMessageResponseDtoSchema,
      404: AuthMessageResponseDtoSchema,
    },
    summary: "Set a new password using the token from the reset link. Revokes all sessions.",
  },

  // GET /auth/sessions — Bearer. Liste les sessions actives de l'appelant ; la
  // session courante est marquée.
  sessions: {
    method: "GET",
    path: "/auth/sessions",
    responses: {
      200: SessionListResponseDtoSchema,
      401: UnauthorizedErrorSchema,
    },
    summary: "List the caller's active sessions (Bearer). The current session is flagged.",
  },

  // POST /auth/sessions/:id/revoke — Bearer. Révoque une de ses propres sessions par
  // id.
  revokeSession: {
    method: "POST",
    path: "/auth/sessions/:id/revoke",
    pathParams: SessionParamsDtoSchema,
    body: c.noBody(),
    responses: {
      200: AuthMessageResponseDtoSchema,
      401: UnauthorizedErrorSchema,
      404: AuthMessageResponseDtoSchema,
    },
    summary: "Revoke one of the caller's own sessions by id (Bearer).",
  },

  // POST /auth/sessions/revoke-others — Bearer. Révoque toutes les sessions sauf la
  // courante (déconnexion partout ailleurs).
  revokeOtherSessions: {
    method: "POST",
    path: "/auth/sessions/revoke-others",
    body: c.noBody(),
    responses: {
      200: AuthMessageResponseDtoSchema,
      401: UnauthorizedErrorSchema,
    },
    summary: "Revoke every session except the current one (Bearer). Log out everywhere else.",
  },

  // POST /auth/totp/enroll — Bearer. Démarre l'enrôlement TOTP : renvoie l'URL
  // otpauth + le secret à encoder en QR pour l'app d'authentification.
  totpEnroll: {
    method: "POST",
    path: "/auth/totp/enroll",
    body: c.noBody(),
    responses: {
      200: TotpEnrollResponseSchema,
      401: UnauthorizedErrorSchema,
      409: ConflictErrorSchema,
    },
    summary: "Begin TOTP enrollment. Returns the otpauth URL + secret to QR-encode for the authenticator app.",
  },

  // POST /auth/totp/confirm — Bearer. Confirme l'enrôlement en vérifiant le premier
  // code TOTP ; bascule totpEnabled=true.
  totpConfirm: {
    method: "POST",
    path: "/auth/totp/confirm",
    body: TotpCodeRequestSchema,
    responses: {
      200: AuthMessageResponseDtoSchema,
      400: AuthMessageResponseDtoSchema,
      401: UnauthorizedErrorSchema,
    },
    summary: "Confirm enrollment by verifying the first TOTP code. Flips totpEnabled=true.",
  },

  // POST /auth/totp/disable — Bearer. Désactive le TOTP ; exige la confirmation du
  // mot de passe actuel (et un token de step-up en production).
  totpDisable: {
    method: "POST",
    path: "/auth/totp/disable",
    body: TotpDisableRequestSchema,
    responses: {
      200: AuthMessageResponseDtoSchema,
      401: UnauthorizedErrorSchema,
    },
    summary: "Disable TOTP. Requires current password confirmation (and a step-up token in production).",
  },

  // POST /auth/step-up — Bearer. Vérifie un code TOTP récent et émet un token de
  // step-up éphémère valable pour une seule opération sensible.
  stepUp: {
    method: "POST",
    path: "/auth/step-up",
    body: StepUpRequestSchema,
    responses: {
      200: StepUpResponseSchema,
      401: UnauthorizedErrorSchema,
    },
    summary: "Verify a fresh TOTP code (Bearer) and mint a short-lived step-up token for one sensitive operation.",
  },
});
