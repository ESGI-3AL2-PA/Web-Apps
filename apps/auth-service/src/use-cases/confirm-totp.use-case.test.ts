import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IUserReaderRepository, UserRecord } from "../repositories/User/user-reader.repository.js";
import { confirmTotpUseCase } from "./confirm-totp.use-case.js";

// Stub the otplib wrapper: a "valid" code resolves to a known step, an invalid
// one to null — no real HOTP computation.
vi.mock("../services/totp.js", () => ({
  verifyTotpStep: vi.fn(),
}));

import { verifyTotpStep } from "../services/totp.js";

const verifyTotpStepMock = vi.mocked(verifyTotpStep);

const makeUser = (over: Partial<UserRecord> = {}): UserRecord => ({
  id: "user-1",
  email: "user@example.com",
  passwordHash: "stored-hash",
  firstName: "Test",
  lastName: "User",
  role: "user",
  address: "1 rue de Test",
  districtId: "district-1",
  balance: 0,
  banned: false,
  emailVerified: true,
  totpSecret: "SECRET",
  totpEnabled: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...over,
});

type UserReaderMock = { [K in keyof IUserReaderRepository]: ReturnType<typeof vi.fn> };

const makeUserReader = (user: UserRecord | null): UserReaderMock => ({
  findByEmail: vi.fn().mockResolvedValue(null),
  findById: vi.fn().mockResolvedValue(user),
  setEmailVerified: vi.fn().mockResolvedValue(undefined),
  setPasswordHash: vi.fn().mockResolvedValue(undefined),
  setTotpSecret: vi.fn().mockResolvedValue(undefined),
  consumeTotpStep: vi.fn().mockResolvedValue(true),
});

describe("confirmTotpUseCase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyTotpStepMock.mockReturnValue(12345);
  });

  it("a valid, unused code flips the enrollment to enabled", async () => {
    const userReader = makeUserReader(makeUser());
    const confirm = confirmTotpUseCase(userReader as unknown as IUserReaderRepository);

    const result = await confirm("user-1", "123456");

    expect(result).toBe("ok");
    expect(userReader.consumeTotpStep).toHaveBeenCalledWith("user-1", 12345);
    // Persisted with the SAME secret but enabled=true.
    expect(userReader.setTotpSecret).toHaveBeenCalledWith("user-1", "SECRET", true);
  });

  it("returns user-not-found for an unknown user", async () => {
    const userReader = makeUserReader(null);
    const confirm = confirmTotpUseCase(userReader as unknown as IUserReaderRepository);

    const result = await confirm("ghost", "123456");

    expect(result).toBe("user-not-found");
    expect(userReader.setTotpSecret).not.toHaveBeenCalled();
  });

  it("returns no-enrollment when there is no pending secret to confirm", async () => {
    const userReader = makeUserReader(makeUser({ totpSecret: null }));
    const confirm = confirmTotpUseCase(userReader as unknown as IUserReaderRepository);

    const result = await confirm("user-1", "123456");

    expect(result).toBe("no-enrollment");
    expect(verifyTotpStepMock).not.toHaveBeenCalled();
  });

  it("an invalid code does not enable TOTP", async () => {
    verifyTotpStepMock.mockReturnValue(null);
    const userReader = makeUserReader(makeUser());
    const confirm = confirmTotpUseCase(userReader as unknown as IUserReaderRepository);

    const result = await confirm("user-1", "000000");

    expect(result).toBe("invalid-code");
    expect(userReader.consumeTotpStep).not.toHaveBeenCalled();
    expect(userReader.setTotpSecret).not.toHaveBeenCalled();
  });

  it("a replayed confirmation code (step already consumed) does not enable TOTP", async () => {
    const userReader = makeUserReader(makeUser());
    userReader.consumeTotpStep.mockResolvedValue(false);
    const confirm = confirmTotpUseCase(userReader as unknown as IUserReaderRepository);

    const result = await confirm("user-1", "123456");

    expect(result).toBe("invalid-code");
    expect(userReader.setTotpSecret).not.toHaveBeenCalled();
  });
});
