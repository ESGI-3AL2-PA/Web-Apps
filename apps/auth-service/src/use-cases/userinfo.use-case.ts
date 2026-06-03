import { jwtVerify } from "jose";
import { getPublicKey } from "../keys.js";
import type { IUserReaderRepository } from "../repositories/User/user-reader.repository.js";

export const userinfoUseCase = (userReader: IUserReaderRepository) => {
  return async (accessToken: string) => {
    // Restrict to real access tokens — without iss/aud the pre-2FA "mfa" token
    // (and any other auth-service-signed token) would be accepted here.
    const { payload } = await jwtVerify(accessToken, getPublicKey(), {
      algorithms: ["RS256"],
      issuer: "auth-service",
      audience: "api",
    });

    const userId = payload.sub;
    if (!userId) return null;

    const user = await userReader.findById(userId);
    if (!user) return null;

    // Never expose the password hash or the TOTP secret.
    const { passwordHash: _passwordHash, totpSecret: _totpSecret, ...userDto } = user;
    return userDto;
  };
};
