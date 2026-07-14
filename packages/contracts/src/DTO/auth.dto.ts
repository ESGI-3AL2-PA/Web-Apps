import { z } from "../zod";
import { UserResponseDtoSchema } from "./user.dto";
import { StrongPasswordSchema } from "./password.schema";

export const LoginRequestDtoSchema = z
  .object({
    email: z.string().email().openapi({ description: "User's email address", example: "john.doe@example.com" }),
    password: z.string().min(8).openapi({ description: "User's password" }),
  })
  .openapi({ title: "LoginRequest" });
export type LoginRequestDto = z.infer<typeof LoginRequestDtoSchema>;

export const LoginResponseDtoSchema = z
  .object({
    access_token: z.string().openapi({ description: "JWT access token (RS256)" }),
    csrf_token: z.string().openapi({ description: "CSRF token to send in X-CSRF-Token on subsequent refresh/logout" }),
    user: UserResponseDtoSchema,
  })
  .openapi({ title: "LoginResponse" });
export type LoginResponseDto = z.infer<typeof LoginResponseDtoSchema>;

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

export const ResetPasswordRequestSchema = z
  .object({
    token: z.string().min(1),
    newPassword: StrongPasswordSchema,
  })
  .openapi({ title: "ResetPasswordRequest" });
export type ResetPasswordRequestDto = z.infer<typeof ResetPasswordRequestSchema>;

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

export const MfaRequiredResponseSchema = z
  .object({
    mfa_required: z.literal(true),
    mfa_token: z.string().openapi({ description: "Short-lived token to send to /auth/login/mfa with the TOTP code" }),
  })
  .openapi({ title: "MfaRequiredResponse" });
export type MfaRequiredResponseDto = z.infer<typeof MfaRequiredResponseSchema>;

export const LoginMfaRequestSchema = z
  .object({
    mfa_token: z.string().min(1),
    code: z.string().regex(/^\d{6}$/, "6-digit code required"),
  })
  .openapi({ title: "LoginMfaRequest" });
export type LoginMfaRequestDto = z.infer<typeof LoginMfaRequestSchema>;

export const TotpEnrollResponseSchema = z
  .object({
    otpauth_url: z.string(),
    secret: z.string(),
  })
  .openapi({ title: "TotpEnrollResponse" });
export type TotpEnrollResponseDto = z.infer<typeof TotpEnrollResponseSchema>;

export const TotpCodeRequestSchema = z
  .object({
    code: z.string().regex(/^\d{6}$/, "6-digit code required"),
  })
  .openapi({ title: "TotpCodeRequest" });
export type TotpCodeRequestDto = z.infer<typeof TotpCodeRequestSchema>;

export const TotpDisableRequestSchema = z
  .object({
    password: z.string().min(1),
  })
  .openapi({ title: "TotpDisableRequest" });
export type TotpDisableRequestDto = z.infer<typeof TotpDisableRequestSchema>;

export const UnauthorizedErrorSchema = z
  .object({
    message: z.string().openapi({ description: "Error message" }),
  })
  .openapi({ title: "UnauthorizedError", description: "Authentication required or invalid credentials" });
export type UnauthorizedError = z.infer<typeof UnauthorizedErrorSchema>;

export const ForbiddenErrorSchema = z
  .object({
    message: z.string().openapi({ description: "Error message" }),
  })
  .openapi({ title: "ForbiddenError", description: "Insufficient permissions" });
export type ForbiddenError = z.infer<typeof ForbiddenErrorSchema>;

export const ConflictErrorSchema = z
  .object({
    message: z.string().openapi({ description: "Error message" }),
  })
  .openapi({ title: "ConflictError", description: "Resource already exists" });
export type ConflictError = z.infer<typeof ConflictErrorSchema>;

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
  })
  .openapi({ title: "RegisterRequest" });
export type RegisterRequestDto = z.infer<typeof RegisterRequestDtoSchema>;
