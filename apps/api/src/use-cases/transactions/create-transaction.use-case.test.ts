// Suite de tests du cas d'usage de création de transaction : vérifie uniquement les
// règles d'AUTORISATION (périmètre quartier, droits de mint/burn selon le rôle),
// pas la mécanique de mouvement de solde elle-même.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CreateTransactionDto } from "@repo/contracts";
import type { User } from "../../entities/user.entity.js";
import type { IUserRepository } from "../../repositories/User/user.repository.js";
import type { ITransactionRepository } from "../../repositories/Transaction/transaction.repository.js";
import { createTransactionUseCase, type TransactionActor } from "./create-transaction.use-case.js";

// Exécute le code monétaire sans vraie session Mongo : on se contente d'invoquer le callback.
vi.mock("../../repositories/tx.js", () => ({
  runInTransaction: (fn: (session?: unknown) => unknown) => fn(undefined),
}));

// Utilisateur factice avec un solde volontairement énorme pour ne jamais buter sur le débit.
const makeUser = (id: string, districtId: string): User => ({ id, districtId, balance: 1_000_000 }) as unknown as User;

// Repository utilisateur bouchonné : résolution par id depuis un dictionnaire en mémoire.
const makeUserRepo = (users: Record<string, User>): IUserRepository =>
  ({
    getUserById: vi.fn(async (id: string) => users[id] ?? null),
  }) as unknown as IUserRepository;

// Repository de transactions bouchonné : débit/crédit toujours réussis, écritures synthétisées.
const makeTxRepo = (): ITransactionRepository =>
  ({
    tryDebit: vi.fn(async () => true),
    adjustBalance: vi.fn(async () => 1),
    createTransactions: vi.fn(async (entries: unknown[]) =>
      entries.map((e, i) => ({ ...(e as object), id: `t${i}`, createdAt: "2026-07-14T00:00:00.000Z" })),
    ),
  }) as unknown as ITransactionRepository;

const run = (
  txRepo: ITransactionRepository,
  userRepo: IUserRepository,
  body: CreateTransactionDto,
  actor: TransactionActor,
) => createTransactionUseCase(txRepo, userRepo)(body, actor);

describe("createTransactionUseCase authorization", () => {
  beforeEach(() => vi.clearAllMocks());

  // (a) Un administrateur de quartier ne peut pas toucher un utilisateur hors de son quartier.
  it("(a) district admin CANNOT move points to/from a user outside their district", async () => {
    const users = {
      alice: makeUser("alice", "district-1"),
      bob: makeUser("bob", "district-2"), // other district
    };
    const txRepo = makeTxRepo();
    const result = await run(
      txRepo,
      makeUserRepo(users),
      { fromUserId: "alice", toUserId: "bob", amount: 100 },
      {
        sub: "admin-1",
        role: "admin",
        adminDistrictId: "district-1",
      },
    );

    expect(result.kind).toBe("forbidden");
    expect(txRepo.tryDebit).not.toHaveBeenCalled();
    expect(txRepo.adjustBalance).not.toHaveBeenCalled();
  });

  // (a') En revanche, il peut déplacer des points entre deux membres de son propre quartier.
  it("(a') district admin CAN move points between two users in their own district", async () => {
    const users = {
      alice: makeUser("alice", "district-1"),
      carol: makeUser("carol", "district-1"),
    };
    const result = await run(
      makeTxRepo(),
      makeUserRepo(users),
      { fromUserId: "alice", toUserId: "carol", amount: 100 },
      {
        sub: "admin-1",
        role: "admin",
        adminDistrictId: "district-1",
      },
    );

    expect(result.kind).toBe("ok");
  });

  // (b) Un administrateur de quartier ne peut pas créer de points (mint) : sans `fromUserId`, refus.
  it("(b) district admin CANNOT mint (omitted fromUserId is rejected)", async () => {
    const users = { carol: makeUser("carol", "district-1") };
    const txRepo = makeTxRepo();
    const result = await run(
      txRepo,
      makeUserRepo(users),
      { toUserId: "carol", amount: 100 },
      {
        sub: "admin-1",
        role: "admin",
        adminDistrictId: "district-1",
      },
    );

    expect(result.kind).toBe("forbidden");
    expect(txRepo.adjustBalance).not.toHaveBeenCalled();
  });

  // (c) Un superAdmin peut créer des points : l'absence de `fromUserId` est honorée (mint).
  it("(c) superAdmin CAN mint (omitted fromUserId is honored)", async () => {
    const users = { carol: makeUser("carol", "district-1") };
    const txRepo = makeTxRepo();
    const result = await run(
      txRepo,
      makeUserRepo(users),
      { toUserId: "carol", amount: 100 },
      {
        sub: "super-1",
        role: "superAdmin",
        adminDistrictId: null,
      },
    );

    expect(result.kind).toBe("ok");
    expect(txRepo.tryDebit).not.toHaveBeenCalled(); // pas de source : crédit pur / création
    expect(txRepo.adjustBalance).toHaveBeenCalledWith("carol", 100, undefined);
  });

  // (d) Un non-admin est forcé à sa propre identité comme source : un `fromUserId` falsifié est ignoré.
  it("(d) non-admin is forced to their own sub as the source (spoofed fromUserId ignored)", async () => {
    const users = {
      "user-self": makeUser("user-self", "district-1"),
      victim: makeUser("victim", "district-9"),
    };
    const txRepo = makeTxRepo();
    // Corps malveillant tentant de vider `victim` ; le cas d'usage doit débiter l'appelant à la place.
    const result = await run(
      txRepo,
      makeUserRepo(users),
      { fromUserId: "victim", toUserId: "user-self", amount: 100 },
      {
        sub: "user-self",
        role: "user",
        adminDistrictId: null,
      },
    );

    expect(result.kind).toBe("ok");
    expect(txRepo.tryDebit).toHaveBeenCalledWith("user-self", 100, undefined);
    expect(txRepo.tryDebit).not.toHaveBeenCalledWith("victim", expect.anything(), expect.anything());
  });
});
