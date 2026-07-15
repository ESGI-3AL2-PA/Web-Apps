import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IAuthTokenRepository } from "../repositories/AuthToken/auth-token.repository.js";
import type { IUserReaderRepository, UserRecord } from "../repositories/User/user-reader.repository.js";
import { registerUseCase, TERMS_VERSION } from "./register.use-case.js";

// The use-case signs a service JWT and emails a verification link; neither is under
// test here, so stub the key provider and the mailer.
vi.mock("../keys.js", () => ({
  getPrivateKey: vi.fn().mockReturnValue("fake-private-key"),
}));
vi.mock("jose", () => ({
  SignJWT: class {
    setProtectedHeader() {
      return this;
    }
    setSubject() {
      return this;
    }
    setIssuer() {
      return this;
    }
    setAudience() {
      return this;
    }
    setIssuedAt() {
      return this;
    }
    setExpirationTime() {
      return this;
    }
    async sign() {
      return "fake.service.token";
    }
  },
}));
const sendVerification = vi.fn().mockResolvedValue(undefined);
vi.mock("./send-verification-email.use-case.js", () => ({
  sendVerificationEmailUseCase: () => sendVerification,
}));

const makeUser = (over: Partial<UserRecord> = {}): UserRecord => ({
  id: "user-1",
  email: "jane@example.com",
  passwordHash: "hash",
  firstName: "Jane",
  lastName: "Doe",
  role: "user",
  address: "1 rue de Test",
  districtId: "district-1",
  balance: 0,
  banned: false,
  emailVerified: false,
  totpSecret: null,
  totpEnabled: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...over,
});

const makeUserReader = (): IUserReaderRepository => ({
  findByEmail: vi.fn().mockResolvedValue(null),
  findById: vi.fn().mockResolvedValue(null),
  setEmailVerified: vi.fn().mockResolvedValue(undefined),
  setPasswordHash: vi.fn().mockResolvedValue(undefined),
  setTotpSecret: vi.fn().mockResolvedValue(undefined),
  consumeTotpStep: vi.fn().mockResolvedValue(true),
});

const authTokenRepo = {} as IAuthTokenRepository;

const baseInput = {
  firstName: "Jane",
  lastName: "Doe",
  email: "jane@example.com",
  password: "Sup3rStr0ng!Pass",
  address: "1 rue de Test",
  acceptedTerms: true as const,
};

describe("registerUseCase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects registration when terms are not accepted, without touching the repo or API", async () => {
    const userReader = makeUserReader();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const register = registerUseCase(userReader, authTokenRepo);
    const result = await register({ ...baseInput, acceptedTerms: false as unknown as true });

    expect(result).toBe("terms-not-accepted");
    expect(userReader.findByEmail).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("stamps a timestamped, versioned consent record on the create-user hop when terms are accepted", async () => {
    const userReader = makeUserReader();
    (userReader.findByEmail as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(null) // pre-create existence check
      .mockResolvedValueOnce(makeUser()); // post-create lookup

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);

    const register = registerUseCase(userReader, authTokenRepo);
    const before = Date.now();
    const result = await register(baseInput);
    const after = Date.now();

    expect(result).toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    // transport-only flag is dropped, consent record is stamped
    expect(body).not.toHaveProperty("acceptedTerms");
    expect(body.termsVersion).toBe(TERMS_VERSION);
    const stampedAt = new Date(body.acceptedTermsAt).getTime();
    expect(stampedAt).toBeGreaterThanOrEqual(before);
    expect(stampedAt).toBeLessThanOrEqual(after);
  });
});
