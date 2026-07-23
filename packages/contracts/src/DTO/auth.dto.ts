// DTO zod de l'authentification : login (avec défis MFA / enrôlement TOTP),
// refresh + CSRF, logout, vérification d'email, mot de passe oublié / réinitialisé,
// gestion des sessions, step-up (ré-authentification pour une opération sensible),
// enrôlement / désactivation TOTP, les enveloppes d'erreur, et le register.
import { z } from "../zod";
import { UserResponseDtoSchema, LangSchema } from "./user.dto";
import { StrongPasswordSchema } from "./password.schema";

/** Corps du POST /auth/login : identifiants email + mot de passe (min 8). */
export const LoginRequestDtoSchema = z
  .object({
    email: z.string().email().openapi({ description: "User's email address", example: "john.doe@example.com" }),
    password: z.string().min(8).openapi({ description: "User's password" }),
  })
  .openapi({ title: "LoginRequest" });
export type LoginRequestDto = z.infer<typeof LoginRequestDtoSchema>;

// Login réussi : access token JWT + CSRF token (le refresh token part en cookie httpOnly).
export const LoginResponseDtoSchema = z
  .object({
    access_token: z.string().openapi({ description: "JWT access token (RS256)" }),
    csrf_token: z.string().openapi({ description: "CSRF token to send in X-CSRF-Token on subsequent refresh/logout" }),
    user: UserResponseDtoSchema,
  })
  .openapi({ title: "LoginResponse" });
export type LoginResponseDto = z.infer<typeof LoginResponseDtoSchema>;

// Réponse du refresh : nouvel access token + CSRF token pivoté (rotation à chaque refresh).
export const RefreshResponseDtoSchema = z
  .object({
    access_token: z.string().openapi({ description: "New JWT access token" }),
    csrf_token: z.string().openapi({ description: "Rotated CSRF token" }),
  })
  .openapi({ title: "RefreshResponse" });
export type RefreshResponseDto = z.infer<typeof RefreshResponseDtoSchema>;

export const LogoutResponseDtoSchema = z
  .object({
    success: z.boolean().openapi({ description: "Whether logout was successful" }),
  })
  .openapi({ title: "LogoutResponse" });
export type LogoutResponseDto = z.infer<typeof LogoutResponseDtoSchema>;

// GET /auth/csrf : renvoie le CSRF token courant issu du cookie (vide si non connecté).
export const CsrfResponseDtoSchema = z
  .object({
    csrf_token: z.string().openapi({ description: "Current CSRF token from cookie (empty if not logged in)" }),
  })
  .openapi({ title: "CsrfResponse" });
export type CsrfResponseDto = z.infer<typeof CsrfResponseDtoSchema>;

export const AuthMessageResponseDtoSchema = z
  .object({
    message: z.string(),
  })
  .openapi({ title: "AuthMessageResponse" });
export type AuthMessageResponseDto = z.infer<typeof AuthMessageResponseDtoSchema>;

// Query de vérification d'email : le token à usage unique envoyé par mail.
export const VerifyEmailQuerySchema = z
  .object({
    token: z.string().min(1),
  })
  .openapi({ title: "VerifyEmailQuery" });
export type VerifyEmailQueryDto = z.infer<typeof VerifyEmailQuerySchema>;

export const ResendVerificationRequestSchema = z
  .object({
    email: z.string().email(),
  })
  .openapi({ title: "ResendVerificationRequest" });
export type ResendVerificationRequestDto = z.infer<typeof ResendVerificationRequestSchema>;

export const ForgotPasswordRequestSchema = z
  .object({
    email: z.string().email(),
  })
  .openapi({ title: "ForgotPasswordRequest" });
export type ForgotPasswordRequestDto = z.infer<typeof ForgotPasswordRequestSchema>;

// Réinitialisation : token reçu par mail + nouveau mot de passe (règles StrongPassword).
export const ResetPasswordRequestSchema = z
  .object({
    token: z.string().min(1),
    newPassword: StrongPasswordSchema,
  })
  .openapi({ title: "ResetPasswordRequest" });
export type ResetPasswordRequestDto = z.infer<typeof ResetPasswordRequestSchema>;

// Session active (adossée à un refresh token) listée dans la gestion des appareils.
// `current` marque la session qui émet la requête.
export const SessionResponseDtoSchema = z
  .object({
    id: z.string().openapi({ description: "Session (refresh-token) id" }),
    userAgent: z.string().nullable().openapi({ description: "User-agent captured at login" }),
    ip: z.string().nullable().openapi({ description: "IP address captured at login" }),
    createdAt: z.string().datetime().openapi({ description: "When the session was created" }),
    lastUsedAt: z.string().datetime().nullable().openapi({ description: "Last time the session was refreshed" }),
    expiresAt: z.string().datetime().openapi({ description: "When the session expires" }),
    current: z.boolean().openapi({ description: "Whether this is the session making the request" }),
  })
  .openapi({ title: "SessionResponse" });
export type SessionResponseDto = z.infer<typeof SessionResponseDtoSchema>;

export const SessionListResponseDtoSchema = z.array(SessionResponseDtoSchema).openapi({ title: "SessionListResponse" });
export type SessionListResponseDto = z.infer<typeof SessionListResponseDtoSchema>;

export const SessionParamsDtoSchema = z.object({ id: z.string().min(1) }).openapi({ title: "SessionParams" });
export type SessionParamsDto = z.infer<typeof SessionParamsDtoSchema>;

// Défi MFA : le login s'arrête là, il faut rejouer le code TOTP via /auth/login/mfa
// en présentant ce mfa_token éphémère.
export const MfaRequiredResponseSchema = z
  .object({
    mfa_required: z.literal(true),
    mfa_token: z.string().openapi({ description: "Short-lived token to send to /auth/login/mfa with the TOTP code" }),
  })
  .openapi({ title: "MfaRequiredResponse" });
export type MfaRequiredResponseDto = z.infer<typeof MfaRequiredResponseSchema>;

// Second pas du login MFA : le mfa_token reçu + le code TOTP (exactement 6 chiffres).
export const LoginMfaRequestSchema = z
  .object({
    mfa_token: z.string().min(1),
    code: z.string().regex(/^\d{6}$/, "6-digit code required"),
  })
  .openapi({ title: "LoginMfaRequest" });
export type LoginMfaRequestDto = z.infer<typeof LoginMfaRequestSchema>;

// Défi d'enrôlement : compte qui doit activer le TOTP avant de continuer ; le
// enroll_token pilote la cérémonie /auth/login/enroll/*.
export const EnrollmentRequiredResponseSchema = z
  .object({
    enrollment_required: z.literal(true),
    enroll_token: z.string().openapi({ description: "Short-lived ticket to drive the /auth/login/enroll/* ceremony" }),
  })
  .openapi({ title: "EnrollmentRequiredResponse" });
export type EnrollmentRequiredResponseDto = z.infer<typeof EnrollmentRequiredResponseSchema>;

// Réponse de login non finalisée : soit un défi MFA, soit un défi d'enrôlement.
export const LoginChallengeResponseSchema = z
  .union([MfaRequiredResponseSchema, EnrollmentRequiredResponseSchema])
  .openapi({ title: "LoginChallengeResponse" });
export type LoginChallengeResponseDto = z.infer<typeof LoginChallengeResponseSchema>;

// Step-up : on redemande le code TOTP pour obtenir un jeton autorisant UNE opération sensible.
export const StepUpRequestSchema = z
  .object({
    code: z.string().regex(/^\d{6}$/, "6-digit code required"),
  })
  .openapi({ title: "StepUpRequest" });
export type StepUpRequestDto = z.infer<typeof StepUpRequestSchema>;

// Jeton step-up éphémère à renvoyer dans l'en-tête X-Step-Up-Token de l'opération autorisée.
export const StepUpResponseSchema = z
  .object({
    step_up_token: z
      .string()
      .openapi({ description: "Short-lived token to send in X-Step-Up-Token to authorize one sensitive operation" }),
  })
  .openapi({ title: "StepUpResponse" });
export type StepUpResponseDto = z.infer<typeof StepUpResponseSchema>;

// Début d'enrôlement TOTP : URL otpauth:// (pour le QR code) + secret en clair (saisie manuelle).
export const TotpEnrollResponseSchema = z
  .object({
    otpauth_url: z.string(),
    secret: z.string(),
  })
  .openapi({ title: "TotpEnrollResponse" });
export type TotpEnrollResponseDto = z.infer<typeof TotpEnrollResponseSchema>;

export const EnrollStartRequestSchema = z
  .object({
    enroll_token: z.string().min(1),
  })
  .openapi({ title: "EnrollStartRequest" });
export type EnrollStartRequestDto = z.infer<typeof EnrollStartRequestSchema>;

// Confirmation d'enrôlement forcé : le ticket enroll_token + un premier code TOTP valide.
export const EnrollConfirmRequestSchema = z
  .object({
    enroll_token: z.string().min(1),
    code: z.string().regex(/^\d{6}$/, "6-digit code required"),
  })
  .openapi({ title: "EnrollConfirmRequest" });
export type EnrollConfirmRequestDto = z.infer<typeof EnrollConfirmRequestSchema>;

// Simple code TOTP à 6 chiffres (activation depuis le profil, etc.).
export const TotpCodeRequestSchema = z
  .object({
    code: z.string().regex(/^\d{6}$/, "6-digit code required"),
  })
  .openapi({ title: "TotpCodeRequest" });
export type TotpCodeRequestDto = z.infer<typeof TotpCodeRequestSchema>;

// Désactivation du TOTP : ré-authentification par le mot de passe courant.
export const TotpDisableRequestSchema = z
  .object({
    password: z.string().min(1),
  })
  .openapi({ title: "TotpDisableRequest" });
export type TotpDisableRequestDto = z.infer<typeof TotpDisableRequestSchema>;

// Enveloppes d'erreur normalisées renvoyées par l'auth-service (401 / 403 / 409).
export const UnauthorizedErrorSchema = z
  .object({
    message: z.string().openapi({ description: "Error message" }),
  })
  .openapi({ title: "UnauthorizedError", description: "Authentication required or invalid credentials" });
export type UnauthorizedError = z.infer<typeof UnauthorizedErrorSchema>;

export const ForbiddenErrorSchema = z
  .object({
    message: z.string().openapi({ description: "Error message" }),
    code: z
      .literal("email_not_verified")
      .optional()
      .openapi({ description: "Machine-readable discriminator; present when the account's email is unverified" }),
  })
  .openapi({ title: "ForbiddenError", description: "Insufficient permissions" });
export type ForbiddenError = z.infer<typeof ForbiddenErrorSchema>;

export const ConflictErrorSchema = z
  .object({
    message: z.string().openapi({ description: "Error message" }),
  })
  .openapi({ title: "ConflictError", description: "Resource already exists" });
export type ConflictError = z.infer<typeof ConflictErrorSchema>;

// Corps du register : identité + adresse + mot de passe fort. `lang` fixe la langue des
// emails transactionnels (repli sur Accept-Language puis fr). Traité par l'auth-service
// qui crée ensuite l'utilisateur côté api.
export const RegisterRequestDtoSchema = z
  .object({
    firstName: z.string().min(1).max(100).openapi({ description: "User's first name", example: "John" }),
    lastName: z.string().min(1).max(100).openapi({ description: "User's last name", example: "Doe" }),
    email: z.string().email().openapi({ description: "User's email address", example: "john.doe@example.com" }),
    phone: z.string().optional().openapi({ description: "User's phone number", example: "0612345678" }),
    password: StrongPasswordSchema.openapi({
      description: "Min 12 chars with upper, lower, digit, and symbol",
    }),
    address: z.string().openapi({ description: "User's address", example: "12 Rue de la Paix, Paris" }),
    lang: LangSchema.optional().openapi({
      description: "Active UI language for transactional emails; falls back to Accept-Language, then fr",
    }),
  })
  .openapi({ title: "RegisterRequest" });
export type RegisterRequestDto = z.infer<typeof RegisterRequestDtoSchema>;
