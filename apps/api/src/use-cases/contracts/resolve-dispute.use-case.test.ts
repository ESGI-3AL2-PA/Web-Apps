import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Contract } from "../../entities/contract.entity.js";
import type { IContractRepository } from "../../repositories/Contract/contract.repository.js";
import type { ITransactionRepository } from "../../repositories/Transaction/transaction.repository.js";
import { resolveDisputeUseCase, UnsettleableDisputeError } from "./resolve-dispute.use-case.js";

// Suite de tests de la résolution de signalement : vérifie le versement (release) au
// prestataire, le remboursement (refund) au bénéficiaire, la réponse 404 sur un contrat
// non contesté, le refus de rembourser un contrat déjà réglé, et le release d'un contrat
// déjà complété (simple levée d'état, sans mouvement d'argent).

// Exécute le mouvement d'argent sans vraie transaction Mongo (chemin de repli séquentiel) :
// on teste la logique séquestre/journal du cas d'usage, pas le câblage transactionnel.
vi.mock("../../repositories/tx.js", () => ({
  runInTransaction: (fn: (session?: unknown) => unknown) => fn(undefined),
}));

// Fabrique un contrat de test (contesté par défaut) avec valeurs surchargeable.
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

// Fabrique un mock du repository de contrats, toutes méthodes stubées.
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

// Fabrique un mock du repository de transactions, toutes méthodes stubées.
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

  // release : verse le séquestre bloqué au prestataire une seule fois et écrit une ligne de journal.
  it("release: settles the held escrow to the provider once and writes a ledger row", async () => {
    // resolveDispute renvoie l'état *pré-résolution* (pending, séquestre encore bloqué).
    contractRepo.resolveDispute.mockResolvedValue(makeContract({ signatureStatus: "pending" }));

    const result = await resolveDisputeUseCase(
      contractRepo as unknown as IContractRepository,
      txRepo as unknown as ITransactionRepository,
    )({ id: "contract-1", resolution: "release" });

    expect(contractRepo.resolveDispute).toHaveBeenCalledWith("contract-1", "completed", undefined);
    // Prestataire crédité exactement une fois du prix mis sous séquestre.
    expect(txRepo.adjustBalance).toHaveBeenCalledTimes(1);
    expect(txRepo.adjustBalance).toHaveBeenCalledWith("provider-1", 10, undefined);
    // Ligne de journal correspondante écrite exactement une fois.
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
    // Le contrat résolu est terminal + n'est plus contesté.
    expect(result).toMatchObject({ signatureStatus: "completed", disputed: false, disputeReason: null });
  });

  // refund : rend le séquestre bloqué au bénéficiaire une seule fois.
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

  // Contrat non contesté : resolveDispute renvoie null → réponse 404, aucun mouvement d'argent.
  it("returns null (404) when the contract is not disputed", async () => {
    contractRepo.resolveDispute.mockResolvedValue(null);

    const result = await resolveDisputeUseCase(
      contractRepo as unknown as IContractRepository,
      txRepo as unknown as ITransactionRepository,
    )({ id: "contract-1", resolution: "release" });

    expect(result).toBeNull();
    expect(txRepo.adjustBalance).not.toHaveBeenCalled();
  });

  // Refuse de rembourser un contrat dont le séquestre est déjà réglé (completed) — aucun mouvement d'argent.
  it("refuses to refund a contract whose escrow was already settled (completed) — no money moves", async () => {
    contractRepo.getContractById.mockResolvedValue(makeContract({ signatureStatus: "completed", disputed: true }));

    await expect(
      resolveDisputeUseCase(
        contractRepo as unknown as IContractRepository,
        txRepo as unknown as ITransactionRepository,
      )({ id: "contract-1", resolution: "refund" }),
    ).rejects.toBeInstanceOf(UnsettleableDisputeError);

    // Refusé avant de toucher à l'état ou à l'argent.
    expect(contractRepo.resolveDispute).not.toHaveBeenCalled();
    expect(txRepo.adjustBalance).not.toHaveBeenCalled();
  });

  // release sur un contrat déjà complété : lève juste le signalement, sans mouvement d'argent.
  it("release on an already-completed contract clears the dispute without moving money", async () => {
    // Le séquestre est déjà allé au prestataire à la complétion → release est une pure levée d'état.
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
