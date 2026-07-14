import { randomBytes, createHash, randomUUID } from "crypto";
import { SignJWT } from "jose";
import type { UserRecord } from "../repositories/User/user-reader.repository.js";
import type { IRefreshTokenRepository } from "../repositories/RefreshToken/refresh-token.repository.js";
import type { IDistrictAdminReaderRepository } from "../repositories/DistrictAdmin/district-admin-reader.repository.js";
import { getPrivateKey } from "../keys.js";

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  user: Omit<UserRecord, "passwordHash" | "totpSecret"> & { adminDistrictId: string | null };
}

// Where a session was born — surfaced later in the "active sessions" view.
export interface SessionContext {
  userAgent: string | null;
  ip: string | null;
}

// adminDistrictId is only meaningful for the `admin` role (one district each).
// `superAdmin` is global and `user` administers none — both resolve to null.
export const lookupAdminDistrictId = async (
  user: Pick<UserRecord, "id" | "role">,
  districtAdminReader: IDistrictAdminReaderRepository,
): Promise<string | null> => (user.role === "admin" ? await districtAdminReader.findDistrictIdByUserId(user.id) : null);

// Signs a 15-minute RS256 access token with the standard claims plus the
// district-scoped authorization claims (role + adminDistrictId). Shared by the
// login, MFA, and refresh paths so the claim set never drifts between them.
export const signAccessToken = (
  user: Pick<UserRecord, "id" | "email" | "role" | "firstName" | "lastName">,
  adminDistrictId: string | null,
): Promise<string> =>
  new SignJWT({
    email: user.email,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    adminDistrictId,
  })
    .setProtectedHeader({ alg: "RS256", kid: "auth-1" })
    .setSubject(user.id)
    .setIssuer("auth-service")
    .setAudience("api")
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(getPrivateKey());

// Shared by login + login-mfa: signs an access token, persists a refresh token,
// strips the password hash from the user payload.
export const issueTokensForUser = async (
  user: UserRecord,
  refreshTokenRepo: IRefreshTokenRepository,
  districtAdminReader: IDistrictAdminReaderRepository,
  context?: SessionContext,
): Promise<IssuedTokens> => {
  const adminDistrictId = await lookupAdminDistrictId(user, districtAdminReader);
  const accessToken = await signAccessToken(user, adminDistrictId);

  const rawRefreshToken = randomBytes(64).toString("hex");
  const tokenHash = createHash("sha256").update(rawRefreshToken).digest("hex");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  await refreshTokenRepo.create({
    userId: user.id,
    tokenHash,
    expiresAt: expiresAt.toISOString(),
    expiresAtDate: expiresAt,
    revokedAt: null,
    createdAt: now.toISOString(),
    sessionId: randomUUID(),
    userAgent: context?.userAgent ?? null,
    ip: context?.ip ?? null,
    lastUsedAt: now.toISOString(),
  });

  const { passwordHash: _passwordHash, totpSecret: _totpSecret, ...userDto } = user;
  return { accessToken, refreshToken: rawRefreshToken, user: { ...userDto, adminDistrictId } };
};
