import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "../../entities/user.entity.js";
import type { IUserRepository } from "../../repositories/User/user.repository.js";
import type { ITransactionRepository } from "../../repositories/Transaction/transaction.repository.js";
import type { IDistrictRepository } from "../../repositories/District/district.repository.js";
import type { IGraphRepository } from "../../repositories/Graph/graph.repository.js";
import type { IDistrictAdminRepository } from "../../repositories/DistrictAdmin/district-admin.repository.js";
import type { MembershipDeps } from "../users/district-membership.use-case.js";
import { InMemoryUserRepository } from "../../repositories/User/user.repository.in-memory.js";
import { createDistrictAdminUseCase, DistrictAdminAlreadyExistsError } from "./create-district-admin.use-case.js";

// Run the ledger callback without a real Mongo session (the join grants points).
vi.mock("../../repositories/tx.js", () => ({
  runInTransaction: (fn: (session?: unknown) => unknown) => fn(undefined),
}));

const makeTxRepo = (userRepo: IUserRepository): ITransactionRepository =>
  ({
    adjustBalance: vi.fn(async (id: string, delta: number) => {
      const u = await userRepo.getUserById(id);
      if (!u) return null;
      u.balance += delta;
      return u.balance;
    }),
    createTransactions: vi.fn(async (entries: unknown[]) =>
      entries.map((e, i) => ({ ...(e as object), id: `t${i}`, createdAt: "2026-07-14T00:00:00.000Z" })),
    ),
  }) as unknown as ITransactionRepository;

const seedUser = async (repo: InMemoryUserRepository, over: Partial<User> = {}): Promise<User> =>
  repo.createUser({
    email: `${over.email ?? "u"}@x.io`,
    passwordHash: "h",
    firstName: "U",
    lastName: "U",
    address: "a",
    role: "user",
    districtId: "",
    balance: 0,
    banned: false,
    emailVerified: true,
    totpSecret: null,
    totpEnabled: false,
    ...over,
  } as unknown as Omit<User, "id" | "createdAt" | "updatedAt">);

const makeDeps = (repo: InMemoryUserRepository, startingPoints = 100) => {
  const createDistrictAdmin = vi.fn(async (data: { districtId: string; userId: string }) => ({
    id: "da-1",
    ...data,
    createdAt: "2026-07-14T00:00:00.000Z",
  }));
  const adminRepo = {
    findExisting: vi.fn(async () => null),
    createDistrictAdmin,
  } as unknown as IDistrictAdminRepository;
  const deps: MembershipDeps = {
    userRepository: repo,
    transactionRepository: makeTxRepo(repo),
    districtRepository: {
      getDistrictById: vi.fn(async (id: string) => ({ id, name: "D", startingPoints })),
    } as unknown as IDistrictRepository,
    graphRepository: {
      linkUserLivesIn: vi.fn(async () => {}),
      upsertDistrict: vi.fn(async () => {}),
    } as unknown as IGraphRepository,
  };
  return { adminRepo, deps, createDistrictAdmin };
};

describe("createDistrictAdminUseCase", () => {
  beforeEach(() => vi.clearAllMocks());

  it("promotes a district-less user, sets their district, and grants its starting points", async () => {
    const repo = new InMemoryUserRepository();
    const u = await seedUser(repo, { email: "newbie" });
    const { adminRepo, deps } = makeDeps(repo);

    await createDistrictAdminUseCase(adminRepo, deps)({ districtId: "d1", userId: u.id });

    const promoted = (await repo.getUserById(u.id))!;
    expect(promoted.role).toBe("admin");
    expect(promoted.districtId).toBe("d1");
    expect(promoted.balance).toBe(100);
  });

  it("leaves an existing resident's district and balance untouched", async () => {
    const repo = new InMemoryUserRepository();
    const u = await seedUser(repo, { email: "resident", districtId: "home", balance: 5 });
    const { adminRepo, deps } = makeDeps(repo);

    await createDistrictAdminUseCase(adminRepo, deps)({ districtId: "d1", userId: u.id });

    const promoted = (await repo.getUserById(u.id))!;
    expect(promoted.role).toBe("admin");
    expect(promoted.districtId).toBe("home"); // not moved to d1
    expect(promoted.balance).toBe(5); // no grant
    expect(deps.graphRepository.linkUserLivesIn).not.toHaveBeenCalled();
  });

  it("exempts a superAdmin — no role change, no forced district", async () => {
    const repo = new InMemoryUserRepository();
    const u = await seedUser(repo, { email: "super", role: "superAdmin", districtId: "" });
    const { adminRepo, deps } = makeDeps(repo);

    await createDistrictAdminUseCase(adminRepo, deps)({ districtId: "d1", userId: u.id });

    const after = (await repo.getUserById(u.id))!;
    expect(after.role).toBe("superAdmin");
    expect(after.districtId).toBe("");
    expect(deps.graphRepository.linkUserLivesIn).not.toHaveBeenCalled();
  });

  it("throws when the (districtId, userId) pair already exists", async () => {
    const repo = new InMemoryUserRepository();
    const u = await seedUser(repo);
    const { adminRepo, deps, createDistrictAdmin } = makeDeps(repo);
    (adminRepo.findExisting as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: "da-existing" });

    await expect(
      createDistrictAdminUseCase(adminRepo, deps)({ districtId: "d1", userId: u.id }),
    ).rejects.toBeInstanceOf(DistrictAdminAlreadyExistsError);
    expect(createDistrictAdmin).not.toHaveBeenCalled();
  });
});
