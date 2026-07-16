import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IAuthTokenRepository } from "../repositories/AuthToken/auth-token.repository.js";
import type { IUserReaderRepository, UserRecord } from "../repositories/User/user-reader.repository.js";
import { registerUseCase } from "./register.use-case.js";

// The use-case signs a service JWT and emails a verification link; neither is under
// test here, so stub the key provider and the mailer.
vi.mock("../keys.js", () => ({
  getPrivateKey: vi.fn().mockReturnValue("fake-private-key"),
  getKeyId: vi.fn().mockReturnValue("test-kid"),
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
};

describe("registerUseCase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates the user via the API hop with no terms/consent fields", async () => {
    const userReader = makeUserReader();
    (userReader.findByEmail as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(null) // pre-create existence check
      .mockResolvedValueOnce(makeUser()); // post-create lookup

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);

    const register = registerUseCase(userReader, authTokenRepo);
    const result = await register(baseInput);

    expect(result).toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Consent capture was removed (no ToS/Privacy Policy served yet) — the create-user
    // hop must carry none of the old terms fields.
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body).not.toHaveProperty("acceptedTerms");
    expect(body).not.toHaveProperty("termsVersion");
    expect(body).not.toHaveProperty("acceptedTermsAt");
  });
});
