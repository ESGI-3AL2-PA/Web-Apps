import { randomBytes, timingSafeEqual } from "crypto";
import { initServer } from "@ts-rest/express";
import { jwtVerify } from "jose";
import type { Request } from "express";
import { authContract } from "@repo/contracts";
import { resolve } from "../../repositories/container.js";
import { getPublicKey } from "../../keys.js";
import { loginUseCase } from "../../use-cases/login.use-case.js";
import { loginMfaUseCase } from "../../use-cases/login-mfa.use-case.js";
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

const REFRESH_COOKIE = "refresh_token";
const CSRF_COOKIE = "csrf_token";
const CSRF_HEADER = "x-csrf-token";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: "/auth",
};

// Double-submit pair: the cookie is sent automatically by the browser; the SPA
// fetches the token via GET /auth/csrf and echoes it in X-CSRF-Token. Same
// path/sameSite as the refresh cookie so they travel together.
const CSRF_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/auth",
};

const generateCsrf = () => randomBytes(32).toString("hex");

const csrfValid = (cookieToken: unknown, headerToken: unknown): boolean => {
  if (typeof cookieToken !== "string" || typeof headerToken !== "string") return false;
  if (cookieToken.length === 0 || cookieToken.length !== headerToken.length) return false;
  return timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken));
};

// Verifies a Bearer access token on requests where the auth-service itself is the resource
// (the TOTP enrollment endpoints). Accepts only tokens issued for the api audience.
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

const s = initServer();

export const authRouter = s.router(authContract, {
  login: async ({ body, res }) => {
    const result = await loginUseCase(
      resolve("userReader"),
      resolve("refreshToken"),
      resolve("districtAdmin"),
    )({
      email: body.email,
      password: body.password,
    });

    if (result.kind === "invalid-credentials") {
      return { status: 401 as const, body: { message: "Invalid email or password" } };
    }
    if (result.kind === "email-not-verified") {
      return { status: 403 as const, body: { message: "Email not verified — check your inbox" } };
    }
    if (result.kind === "mfa-required") {
      return { status: 202 as const, body: { mfa_required: true, mfa_token: result.mfaToken } };
    }

    const csrfToken = generateCsrf();
    res.cookie(REFRESH_COOKIE, result.refreshToken, COOKIE_OPTIONS);
    res.cookie(CSRF_COOKIE, csrfToken, CSRF_COOKIE_OPTIONS);

    return {
      status: 200 as const,
      body: { access_token: result.accessToken, csrf_token: csrfToken, user: result.user },
    };
  },

  loginMfa: async ({ body, res }) => {
    const result = await loginMfaUseCase(
      resolve("userReader"),
      resolve("refreshToken"),
      resolve("districtAdmin"),
    )(body.mfa_token, body.code);
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

  register: async ({ body }) => {
    const result = await registerUseCase(resolve("userReader"), resolve("authToken"))(body);

    if (result === "email-taken") {
      return { status: 409 as const, body: { message: "Email already in use" } };
    }

    return {
      status: 202 as const,
      body: { message: "Account created — check your email to verify before logging in" },
    };
  },

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

  resendVerification: async ({ body }) => {
    await resendVerificationUseCase(resolve("userReader"), resolve("authToken"))(body.email);
    return {
      status: 200 as const,
      body: { message: "If that email is registered and unverified, a new link has been sent" },
    };
  },

  forgotPassword: async ({ body }) => {
    await forgotPasswordUseCase(resolve("userReader"), resolve("authToken"))(body.email);
    return {
      status: 200 as const,
      body: { message: "If that email is registered, a password reset link has been sent" },
    };
  },

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

  csrf: async ({ req }) => {
    const token = req.cookies?.[CSRF_COOKIE];
    return { status: 200 as const, body: { csrf_token: typeof token === "string" ? token : "" } };
  },

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

  totpDisable: async ({ req, body }) => {
    const userId = await verifyBearer(req);
    if (!userId) {
      return { status: 401 as const, body: { message: "Missing or invalid access token" } };
    }
    const result = await disableTotpUseCase(resolve("userReader"))(userId, body.password);
    if (result === "ok") {
      return { status: 200 as const, body: { message: "TOTP disabled" } };
    }
    return { status: 401 as const, body: { message: "Wrong password or user not found" } };
  },
});
