import { beforeEach, describe, expect, it, vi } from "vitest";
import { logger } from "../../logger.js";
import type { User } from "../../entities/user.entity.js";
import type { Contract } from "../../entities/contract.entity.js";
import type { IUserRepository } from "../../repositories/User/user.repository.js";
import type { IContractRepository } from "../../repositories/Contract/contract.repository.js";
import type { ITransactionRepository } from "../../repositories/Transaction/transaction.repository.js";
import type { GeneratedContractDocument, IDocumensoService } from "../../services/documenso.service.js";
import {
  ContractPartyNotFoundError,
  DuplicateContractError,
  InsufficientFundsError,
  createContractUseCase,
} from "./create-contract.use-case.js";

const makeUser = (id: string): User =>
  ({ id, email: `${id}@example.com`, firstName: id, lastName: "Doe" }) as unknown as User;

const makeUserRepo = (users: Record<string, User | null>): IUserRepository =>
  ({
    getUserById: vi.fn(async (id: string) => users[id] ?? null),
  }) as unknown as IUserRepository;

const makeContractRepo = (overrides: Partial<Record<keyof IContractRepository, unknown>> = {}): IContractRepository =>
  ({
    findActiveContract: vi.fn(async () => null),
    createContract: vi.fn(
      async (data: Omit<Contract, "id" | "createdAt">) =>
        ({ ...data, id: "contract-1", createdAt: "2026-07-14T00:00:00.000Z" }) as Contract,
    ),
    ...overrides,
  }) as unknown as IContractRepository;

const makeTxRepo = (overrides: Partial<Record<keyof ITransactionRepository, unknown>> = {}): ITransactionRepository =>
  ({
    tryDebit: vi.fn(async () => true),
    adjustBalance: vi.fn(async () => 1),
    createTransactions: vi.fn(async (entries: unknown[]) => entries),
    ...overrides,
  }) as unknown as ITransactionRepository;

const makeDocumenso = (overrides: Partial<IDocumensoService> = {}): IDocumensoService =>
  ({
    enabled: true,
    generateContractDocument: vi.fn(
      async (): Promise<GeneratedContractDocument> => ({
        documentId: 42,
        providerSigningUrl: "https://sign/provider",
        beneficiarySigningUrl: "https://sign/beneficiary",
      }),
    ),
    ...overrides,
  }) as unknown as IDocumensoService;

const baseData = {
  listingId: "listing-1",
  providerId: "provider-1",
  beneficiaryId: "beneficiary-1",
  districtId: "district-1",
  price: 500,
};

const defaultUsers = () => ({
  "provider-1": makeUser("provider-1"),
  "beneficiary-1": makeUser("beneficiary-1"),
});

describe("createContractUseCase", () => {
  beforeEach(() => vi.clearAllMocks());

  it("escrows the price BEFORE generating the Documenso document", async () => {
    const calls: string[] = [];
    const txRepo = makeTxRepo({
      tryDebit: vi.fn(async () => {
        calls.push("tryDebit");
        return true;
      }),
    });
    const documenso = makeDocumenso({
      generateContractDocument: vi.fn(async () => {
        calls.push("generateContractDocument");
        return { documentId: 42, providerSigningUrl: null, beneficiarySigningUrl: null };
      }),
    });
    const contractRepo = makeContractRepo();

    const contract = await createContractUseCase(
      contractRepo,
      makeUserRepo(defaultUsers()),
      documenso,
      txRepo,
    )(baseData);

    expect(calls).toEqual(["tryDebit", "generateContractDocument"]);
    expect(txRepo.tryDebit).toHaveBeenCalledWith("beneficiary-1", 500);
    expect(contract.id).toBe("contract-1");
    // Ledger hold recorded after the contract exists, as a negative transfer_out.
    expect(txRepo.createTransactions).toHaveBeenCalledWith([
      expect.objectContaining({
        userId: "beneficiary-1",
        type: "transfer_out",
        amount: -500,
        refId: "contract-1",
        refType: "contract",
      }),
    ]);
  });

  it("refunds the escrow hold when generateContractDocument throws", async () => {
    const txRepo = makeTxRepo();
    const documenso = makeDocumenso({
      generateContractDocument: vi.fn(async () => {
        throw new Error("documenso boom");
      }),
    });
    const contractRepo = makeContractRepo();

    await expect(
      createContractUseCase(contractRepo, makeUserRepo(defaultUsers()), documenso, txRepo)(baseData),
    ).rejects.toThrow("documenso boom");

    expect(txRepo.tryDebit).toHaveBeenCalledWith("beneficiary-1", 500);
    // Hold rolled back — no contract was persisted, no ledger entry written.
    expect(txRepo.adjustBalance).toHaveBeenCalledWith("beneficiary-1", 500);
    expect(contractRepo.createContract).not.toHaveBeenCalled();
    expect(txRepo.createTransactions).not.toHaveBeenCalled();
  });

  it("maps a Mongo duplicate-key (11000) on persist to DuplicateContractError and refunds", async () => {
    const txRepo = makeTxRepo();
    const contractRepo = makeContractRepo({
      createContract: vi.fn(async () => {
        throw Object.assign(new Error("E11000 dup"), { code: 11000 });
      }),
    });

    await expect(
      createContractUseCase(contractRepo, makeUserRepo(defaultUsers()), makeDocumenso(), txRepo)(baseData),
    ).rejects.toBeInstanceOf(DuplicateContractError);

    expect(txRepo.adjustBalance).toHaveBeenCalledWith("beneficiary-1", 500);
    expect(txRepo.createTransactions).not.toHaveBeenCalled();
  });

  it("does NOT roll back a persisted contract when the ledger write fails", async () => {
    const loggerError = vi.spyOn(logger, "error").mockImplementation(() => {});
    const txRepo = makeTxRepo({
      createTransactions: vi.fn(async () => {
        throw new Error("ledger down");
      }),
    });
    const contractRepo = makeContractRepo();

    // Ledger failure is swallowed — the contract is still returned successfully.
    const contract = await createContractUseCase(
      contractRepo,
      makeUserRepo(defaultUsers()),
      makeDocumenso(),
      txRepo,
    )(baseData);

    expect(contract.id).toBe("contract-1");
    // No refund: the money is correctly held against a live contract.
    expect(txRepo.adjustBalance).not.toHaveBeenCalled();
    expect(loggerError).toHaveBeenCalled();
    loggerError.mockRestore();
  });

  it("throws InsufficientFundsError (no external work) when the debit fails", async () => {
    const txRepo = makeTxRepo({ tryDebit: vi.fn(async () => false) });
    const documenso = makeDocumenso();
    const contractRepo = makeContractRepo();

    await expect(
      createContractUseCase(contractRepo, makeUserRepo(defaultUsers()), documenso, txRepo)(baseData),
    ).rejects.toBeInstanceOf(InsufficientFundsError);

    expect(documenso.generateContractDocument).not.toHaveBeenCalled();
    expect(contractRepo.createContract).not.toHaveBeenCalled();
    expect(txRepo.adjustBalance).not.toHaveBeenCalled();
  });

  it("rejects a duplicate active contract before touching money", async () => {
    const txRepo = makeTxRepo();
    const documenso = makeDocumenso();
    const contractRepo = makeContractRepo({
      findActiveContract: vi.fn(async () => ({ id: "existing" }) as Contract),
    });

    await expect(
      createContractUseCase(contractRepo, makeUserRepo(defaultUsers()), documenso, txRepo)(baseData),
    ).rejects.toBeInstanceOf(DuplicateContractError);

    expect(txRepo.tryDebit).not.toHaveBeenCalled();
    expect(documenso.generateContractDocument).not.toHaveBeenCalled();
  });

  it("throws ContractPartyNotFoundError when a party is missing (no debit)", async () => {
    const txRepo = makeTxRepo();
    const users = { "provider-1": makeUser("provider-1"), "beneficiary-1": null };

    await expect(
      createContractUseCase(makeContractRepo(), makeUserRepo(users), makeDocumenso(), txRepo)(baseData),
    ).rejects.toBeInstanceOf(ContractPartyNotFoundError);

    expect(txRepo.tryDebit).not.toHaveBeenCalled();
  });

  it("skips all money paths for a free (price 0) contract", async () => {
    const txRepo = makeTxRepo();
    const contract = await createContractUseCase(
      makeContractRepo(),
      makeUserRepo(defaultUsers()),
      makeDocumenso(),
      txRepo,
    )({ ...baseData, price: 0 });

    expect(contract.id).toBe("contract-1");
    expect(txRepo.tryDebit).not.toHaveBeenCalled();
    expect(txRepo.createTransactions).not.toHaveBeenCalled();
  });
});
