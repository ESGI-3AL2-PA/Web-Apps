import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "../../entities/user.entity.js";
import type { IUserRepository } from "../../repositories/User/user.repository.js";
import type { ITransactionRepository } from "../../repositories/Transaction/transaction.repository.js";
import type { IDistrictRepository } from "../../repositories/District/district.repository.js";
import type { IGraphRepository } from "../../repositories/Graph/graph.repository.js";
import { InMemoryUserRepository } from "../../repositories/User/user.repository.in-memory.js";
import { joinDistrict, leaveDistrict, type MembershipDeps } from "./district-membership.use-case.js";
import { kickFromDistrictUseCase } from "./kick-from-district.use-case.js";

// Execute the ledger callback without a real Mongo session.
vi.mock("../../repositories/tx.js", () => ({
  runInTransaction: (fn: (session?: unknown) => unknown) => fn(undefined),
}));

// A transaction repo backed by the in-memory user records so balance moves are real and
// conservation can be asserted end-to-end.
const makeTxRepo = (userRepo: IUserRepository): ITransactionRepository =>
  ({
    adjustBalance: vi.fn(async (id: string, delta: number) => {
      const u = await userRepo.getUserById(id);
      if (!u) return null;
      u.balance += delta;
      return u.balance;
    }),
    tryDebit: vi.fn(async (id: string, amount: number) => {
      const u = await userRepo.getUserById(id);
      if (!u || u.balance < amount) return false;
      u.balance -= amount;
      return true;
    }),
    createTransactions: vi.fn(async (entries: unknown[]) =>
      entries.map((e, i) => ({ ...(e as object), id: `t${i}`, createdAt: "2026-07-14T00:00:00.000Z" })),
    ),
  }) as unknown as ITransactionRepository;

const makeDistrictRepo = (startingPoints: number): IDistrictRepository =>
  ({
    getDistrictById: vi.fn(async (id: string) => ({ id, name: "D", startingPoints })),
  }) as unknown as IDistrictRepository;

const graphStub = (): IGraphRepository =>
  ({ linkUserLivesIn: vi.fn(async () => {}), upsertDistrict: vi.fn(async () => {}) }) as unknown as IGraphRepository;

const seedMember = async (
  repo: InMemoryUserRepository,
  id: string,
  districtId: string,
  balance: number,
  createdAt: string,
  role: User["role"] = "user",
): Promise<void> => {
  await repo.createUser({
    email: `${id}@x.io`,
    passwordHash: "h",
    firstName: id,
    lastName: id,
    address: "a",
    role,
    districtId,
    balance,
    banned: false,
    emailVerified: true,
    totpSecret: null,
    totpEnabled: false,
  } as unknown as Omit<User, "id" | "createdAt" | "updatedAt">);
  const created = (await repo.findUsersByDistrict(districtId)).find((u) => u.firstName === id)!;
  created.id = id;
  created.createdAt = createdAt; // control redistribution order (earliest first get the remainder)
};

const makeDeps = (startingPoints = 100): { deps: MembershipDeps; repo: InMemoryUserRepository } => {
  const repo = new InMemoryUserRepository();
  const deps: MembershipDeps = {
    userRepository: repo,
    transactionRepository: makeTxRepo(repo),
    districtRepository: makeDistrictRepo(startingPoints),
    graphRepository: graphStub(),
  };
  return { deps, repo };
};

describe("leaveDistrict — point redistribution", () => {
  beforeEach(() => vi.clearAllMocks());

  it("splits the balance evenly across remaining members, conserving the total (largest-remainder)", async () => {
    const { deps, repo } = makeDeps();
    await seedMember(repo, "leaver", "d1", 150, "2026-01-01T00:00:00.000Z");
    await seedMember(repo, "m1", "d1", 0, "2026-01-02T00:00:00.000Z");
    await seedMember(repo, "m2", "d1", 0, "2026-01-03T00:00:00.000Z");
    await seedMember(repo, "m3", "d1", 0, "2026-01-04T00:00:00.000Z");
    await seedMember(repo, "m4", "d1", 0, "2026-01-05T00:00:00.000Z");

    const updated = await leaveDistrict(deps, "leaver");

    expect(updated?.districtId).toBe("");
    const m = async (id: string) => (await repo.getUserById(id))!.balance;
    // 150 / 4 => 37 each, remainder 2 handed to the two earliest members => 38,38,37,37
    expect(await m("m1")).toBe(38);
    expect(await m("m2")).toBe(38);
    expect(await m("m3")).toBe(37);
    expect(await m("m4")).toBe(37);
    expect(await m("leaver")).toBe(0);
    // Total conserved.
    const total = (await m("m1")) + (await m("m2")) + (await m("m3")) + (await m("m4")) + (await m("leaver"));
    expect(total).toBe(150);
  });

  it("burns the balance when the leaver is the sole member (no one to receive it)", async () => {
    const { deps, repo } = makeDeps();
    await seedMember(repo, "solo", "d1", 100, "2026-01-01T00:00:00.000Z");

    const updated = await leaveDistrict(deps, "solo");

    expect(updated?.districtId).toBe("");
    expect((await repo.getUserById("solo"))!.balance).toBe(0);
  });

  it("is a no-op for an already district-less user", async () => {
    const { deps, repo } = makeDeps();
    await seedMember(repo, "nomad", "", 42, "2026-01-01T00:00:00.000Z");

    const updated = await leaveDistrict(deps, "nomad");

    expect(updated?.balance).toBe(42);
    expect(deps.transactionRepository.tryDebit).not.toHaveBeenCalled();
  });
});

describe("joinDistrict — starting points", () => {
  beforeEach(() => vi.clearAllMocks());

  it("assigns the district and credits its starting points", async () => {
    const { deps, repo } = makeDeps(100);
    await seedMember(repo, "newbie", "", 0, "2026-01-01T00:00:00.000Z");

    const joined = await joinDistrict(deps, "newbie", "d1");

    expect(joined?.districtId).toBe("d1");
    expect(joined?.balance).toBe(100);
  });
});

describe("kickFromDistrictUseCase", () => {
  beforeEach(() => vi.clearAllMocks());

  it("refuses to kick a non-regular user", async () => {
    const { deps, repo } = makeDeps();
    await seedMember(repo, "adm", "d1", 10, "2026-01-01T00:00:00.000Z", "admin");

    const result = await kickFromDistrictUseCase(deps)("adm");

    expect(result.kind).toBe("forbidden");
  });

  it("kicks a regular user, redistributing points and clearing their district", async () => {
    const { deps, repo } = makeDeps();
    await seedMember(repo, "target", "d1", 90, "2026-01-01T00:00:00.000Z");
    await seedMember(repo, "other", "d1", 0, "2026-01-02T00:00:00.000Z");

    const result = await kickFromDistrictUseCase(deps)("target");

    expect(result.kind).toBe("ok");
    expect((await repo.getUserById("target"))!.districtId).toBe("");
    expect((await repo.getUserById("target"))!.balance).toBe(0);
    expect((await repo.getUserById("other"))!.balance).toBe(90);
  });
});
