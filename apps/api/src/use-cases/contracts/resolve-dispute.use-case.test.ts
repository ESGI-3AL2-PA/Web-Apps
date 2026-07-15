import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Contract } from "../../entities/contract.entity.js";
import type { IContractRepository } from "../../repositories/Contract/contract.repository.js";
import type { ITransactionRepository } from "../../repositories/Transaction/transaction.repository.js";
import { resolveDisputeUseCase, UnsettleableDisputeError } from "./resolve-dispute.use-case.js";

// Run the money movement without a real Mongo transaction (sequential fallback path):
// the use-case's escrow/ledger logic is what we're exercising, not the tx wiring.
vi.mock("../../repositories/tx.js", () => ({
  runInTransaction: (fn: (session?: unknown) => unknown) => fn(undefined),
}));

const makeContract = (over: Partial<Contract> = {}): Contract => ({
  id: "contract-1",
  listingId: "listing-1",
  districtId: "district-1",
  providerId: "provider-1",
  beneficiaryId: "beneficiary-1",
  price: 10,
  documensoDocumentId: 42,
  signatureStatus: "pending",
  providerSigningUrl: "https://sign/provider",
  beneficiarySigningUrl: "https://sign/beneficiary",
  disputed: true,
  disputeReason: "no-show",
  createdAt: new Date().toISOString(),
  ...over,
});

type ContractRepoMock = { [K in keyof IContractRepository]: ReturnType<typeof vi.fn> };
type TxRepoMock = { [K in keyof ITransactionRepository]: ReturnType<typeof vi.fn> };

const makeContractRepo = (): ContractRepoMock => ({
  ensureIndexes: vi.fn(),
  getContracts: vi.fn(),
  getContractById: vi.fn().mockResolvedValue(null),
  getContractByDocumensoDocumentId: vi.fn().mockResolvedValue(null),
  completeContract: vi.fn().mockResolvedValue(null),
  rejectContract: vi.fn().mockResolvedValue(null),
  disputeContract: vi.fn().mockResolvedValue(null),
  resolveDispute: vi.fn().mockResolvedValue(null),
  applyNonTerminalStatus: vi.fn().mockResolvedValue(null),
  findActiveContract: vi.fn().mockResolvedValue(null),
  createContract: vi.fn(),
  updateContract: vi.fn(),
  deleteContract: vi.fn(),
});

const makeTxRepo = (): TxRepoMock => ({
  ensureIndexes: vi.fn(),
  getTransactions: vi.fn(),
  createTransactions: vi.fn().mockResolvedValue([]),
  adjustBalance: vi.fn().mockResolvedValue(0),
  tryDebit: vi.fn().mockResolvedValue(true),
  getBalance: vi.fn().mockResolvedValue(0),
  pseudonymiseUser: vi.fn(),
});

describe("resolveDisputeUseCase", () => {
  let contractRepo: ContractRepoMock;
  let txRepo: TxRepoMock;

  beforeEach(() => {
    vi.clearAllMocks();
    contractRepo = makeContractRepo();
    txRepo = makeTxRepo();
  });

  it("release: settles the held escrow to the provider once and writes a ledger row", async () => {
    // resolveDispute returns the *pre-resolution* state (pending, escrow still held).
    contractRepo.resolveDispute.mockResolvedValue(makeContract({ signatureStatus: "pending" }));

    const result = await resolveDisputeUseCase(
      contractRepo as unknown as IContractRepository,
      txRepo as unknown as ITransactionRepository,
    )({ id: "contract-1", resolution: "release" });

    expect(contractRepo.resolveDispute).toHaveBeenCalledWith("contract-1", "completed", undefined);
    // Provider credited exactly once for the escrowed price.
    expect(txRepo.adjustBalance).toHaveBeenCalledTimes(1);
    expect(txRepo.adjustBalance).toHaveBeenCalledWith("provider-1", 10, undefined);
    // Matching ledger row written exactly once.
    expect(txRepo.createTransactions).toHaveBeenCalledTimes(1);
    expect(txRepo.createTransactions.mock.calls[0]![0]).toEqual([
      {
        userId: "provider-1",
        districtId: "district-1",
        type: "transfer_in",
        amount: 10,
        refId: "contract-1",
        refType: "contract",
      },
    ]);
    // The resolved contract is terminal + no longer disputed.
    expect(result).toMatchObject({ signatureStatus: "completed", disputed: false, disputeReason: null });
  });

  it("refund: returns the held escrow to the beneficiary once", async () => {
    contractRepo.getContractById.mockResolvedValue(makeContract({ signatureStatus: "pending" }));
    contractRepo.resolveDispute.mockResolvedValue(makeContract({ signatureStatus: "pending" }));

    const result = await resolveDisputeUseCase(
      contractRepo as unknown as IContractRepository,
      txRepo as unknown as ITransactionRepository,
    )({ id: "contract-1", resolution: "refund" });

    expect(contractRepo.resolveDispute).toHaveBeenCalledWith("contract-1", "rejected", undefined);
    expect(txRepo.adjustBalance).toHaveBeenCalledTimes(1);
    expect(txRepo.adjustBalance).toHaveBeenCalledWith("beneficiary-1", 10, undefined);
    expect(txRepo.createTransactions).toHaveBeenCalledTimes(1);
    expect(txRepo.createTransactions.mock.calls[0]![0]![0]).toMatchObject({
      userId: "beneficiary-1",
      type: "transfer_in",
    });
    expect(result).toMatchObject({ signatureStatus: "rejected", disputed: false });
  });

  it("returns null (404) when the contract is not disputed", async () => {
    contractRepo.resolveDispute.mockResolvedValue(null);

    const result = await resolveDisputeUseCase(
      contractRepo as unknown as IContractRepository,
      txRepo as unknown as ITransactionRepository,
    )({ id: "contract-1", resolution: "release" });

    expect(result).toBeNull();
    expect(txRepo.adjustBalance).not.toHaveBeenCalled();
  });

  it("refuses to refund a contract whose escrow was already settled (completed) — no money moves", async () => {
    contractRepo.getContractById.mockResolvedValue(makeContract({ signatureStatus: "completed", disputed: true }));

    await expect(
      resolveDisputeUseCase(
        contractRepo as unknown as IContractRepository,
        txRepo as unknown as ITransactionRepository,
      )({ id: "contract-1", resolution: "refund" }),
    ).rejects.toBeInstanceOf(UnsettleableDisputeError);

    // Refused before touching state or money.
    expect(contractRepo.resolveDispute).not.toHaveBeenCalled();
    expect(txRepo.adjustBalance).not.toHaveBeenCalled();
  });

  it("release on an already-completed contract clears the dispute without moving money", async () => {
    // Escrow already went to the provider on completion → release is a pure state-clear.
    contractRepo.resolveDispute.mockResolvedValue(makeContract({ signatureStatus: "completed", disputed: true }));

    const result = await resolveDisputeUseCase(
      contractRepo as unknown as IContractRepository,
      txRepo as unknown as ITransactionRepository,
    )({ id: "contract-1", resolution: "release" });

    expect(txRepo.adjustBalance).not.toHaveBeenCalled();
    expect(txRepo.createTransactions).not.toHaveBeenCalled();
    expect(result).toMatchObject({ signatureStatus: "completed", disputed: false });
  });
});
