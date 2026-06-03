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
  MfaRequiredResponseSchema,
  LoginMfaRequestSchema,
  TotpEnrollResponseSchema,
  TotpCodeRequestSchema,
  TotpDisableRequestSchema,
} from "./DTO";

const c = initContract();

export const authContract = c.router({
  login: {
    method: "POST",
    path: "/auth/login",
    body: LoginRequestDtoSchema,
    responses: {
      200: LoginResponseDtoSchema,
      202: MfaRequiredResponseSchema,
      401: UnauthorizedErrorSchema,
      403: ForbiddenErrorSchema,
    },
    summary: "Validate credentials. 200 → tokens; 202 → MFA required; 403 → email not verified.",
  },

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

  csrf: {
    method: "GET",
    path: "/auth/csrf",
    responses: {
      200: CsrfResponseDtoSchema,
    },
    summary: "Bootstrap: return the CSRF token from the cookie for cross-origin SPAs",
  },

  userinfo: {
    method: "GET",
    path: "/auth/userinfo",
    responses: {
      200: UserResponseDtoSchema,
      401: UnauthorizedErrorSchema,
    },
    summary: "Return user claims from Bearer access token",
  },

  register: {
    method: "POST",
    path: "/auth/register",
    body: RegisterRequestDtoSchema,
    responses: {
      202: AuthMessageResponseDtoSchema,
      409: ConflictErrorSchema,
    },
    summary: "Register a new user and email a verification link. No tokens are issued until verified.",
  },

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

  resendVerification: {
    method: "POST",
    path: "/auth/resend-verification",
    body: ResendVerificationRequestSchema,
    responses: {
      200: AuthMessageResponseDtoSchema,
    },
    summary: "Resend the verification email (always 200 — no user enumeration)",
  },

  forgotPassword: {
    method: "POST",
    path: "/auth/forgot-password",
    body: ForgotPasswordRequestSchema,
    responses: {
      200: AuthMessageResponseDtoSchema,
    },
    summary: "Email a one-shot password reset link (always 200 — no user enumeration)",
  },

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

  totpDisable: {
    method: "POST",
    path: "/auth/totp/disable",
    body: TotpDisableRequestSchema,
    responses: {
      200: AuthMessageResponseDtoSchema,
      401: UnauthorizedErrorSchema,
    },
    summary: "Disable TOTP. Requires current password confirmation.",
  },
});
