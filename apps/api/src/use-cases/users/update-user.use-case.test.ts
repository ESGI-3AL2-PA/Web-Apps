import { describe, expect, it, vi } from "vitest";
import type { IUserRepository } from "../../repositories/User/user.repository.js";
import type { IGraphRepository } from "../../repositories/Graph/graph.repository.js";
import type { User } from "../../entities/user.entity.js";
import { updateUserUseCase } from "./update-user.use-case.js";

const makeUser = (overrides: Partial<User> = {}): User => ({
  id: "user-1",
  email: "old@example.com",
  passwordHash: "hash",
  firstName: "Ada",
  lastName: "Lovelace",
  address: "1 Analytical Ave",
  role: "user",
  districtId: "district-1",
  balance: 0,
  banned: false,
  emailVerified: true,
  totpSecret: null,
  totpEnabled: false,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
  ...overrides,
});

const makeUserRepo = (existing: User) => ({
  ensureIndexes: vi.fn(),
  getUsers: vi.fn(),
  getUserById: vi.fn().mockResolvedValue(existing),
  getUserByEmail: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn().mockImplementation(async (id: string, data: Partial<User>) => ({ ...existing, ...data })),
  setBanned: vi.fn(),
  deleteUser: vi.fn(),
});

const makeGraphRepo = () => ({ upsertUser: vi.fn().mockResolvedValue(undefined) });

const run = (repo: ReturnType<typeof makeUserRepo>, graph: ReturnType<typeof makeGraphRepo>) =>
  updateUserUseCase(repo as unknown as IUserRepository, graph as unknown as IGraphRepository);

describe("updateUserUseCase", () => {
  it("resets emailVerified to false when the email changes", async () => {
    const repo = makeUserRepo(makeUser({ emailVerified: true }));
    const graph = makeGraphRepo();

    const result = await run(repo, graph)("user-1", { email: "new@example.com" });

    expect(result.kind).toBe("ok");
    expect(repo.updateUser).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ email: "new@example.com", emailVerified: false }),
    );
  });

  it("leaves emailVerified untouched when the email is unchanged", async () => {
    const repo = makeUserRepo(makeUser({ email: "same@example.com", emailVerified: true }));
    const graph = makeGraphRepo();

    const result = await run(repo, graph)("user-1", { email: "same@example.com", firstName: "Grace" });

    expect(result.kind).toBe("ok");
    const [, update] = repo.updateUser.mock.calls[0]!;
    expect(update).not.toHaveProperty("emailVerified");
  });

  it("does not touch emailVerified when email is not in the payload", async () => {
    const repo = makeUserRepo(makeUser({ emailVerified: true }));
    const graph = makeGraphRepo();

    await run(repo, graph)("user-1", { firstName: "Grace" });

    const [, update] = repo.updateUser.mock.calls[0]!;
    expect(update).not.toHaveProperty("emailVerified");
  });

  it("maps a Mongo duplicate-key (11000) error to an email-conflict result", async () => {
    const repo = makeUserRepo(makeUser());
    repo.updateUser.mockRejectedValueOnce(Object.assign(new Error("E11000 duplicate key"), { code: 11000 }));
    const graph = makeGraphRepo();

    const result = await run(repo, graph)("user-1", { email: "taken@example.com" });

    expect(result).toEqual({ kind: "email-conflict" });
  });

  it("rethrows non-duplicate repository errors", async () => {
    const repo = makeUserRepo(makeUser());
    repo.updateUser.mockRejectedValueOnce(new Error("boom"));
    const graph = makeGraphRepo();

    await expect(run(repo, graph)("user-1", { email: "x@example.com" })).rejects.toThrow("boom");
  });
});
