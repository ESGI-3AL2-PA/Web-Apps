import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Contract } from "../../entities/contract.entity.js";
import type { IContractRepository } from "../../repositories/Contract/contract.repository.js";
import type { ITransactionRepository } from "../../repositories/Transaction/transaction.repository.js";
import { handleDocumensoWebhookUseCase } from "./handle-documenso-webhook.use-case.js";

// Suite de tests du webhook Documenso : vérifie le « gel » du règlement pendant une
// contestation — un contrat contesté n'est pas réglé automatiquement à la complétion,
// tandis qu'un contrat non contesté l'est bien.

// Exécute la logique argent sans vraie transaction Mongo (chemin de repli séquentiel).
vi.mock("../../repositories/tx.js", () => ({
  runInTransaction: (fn: (session?: unknown) => unknown) => fn(undefined),
}));

// Fabrique un contrat de test avec des valeurs par défaut surchargeable.
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
  disputed: false,
  disputeReason: null,
  createdAt: new Date().toISOString(),
  ...over,
});

type ContractRepoMock = { [K in keyof IContractRepository]: ReturnType<typeof vi.fn> };
type TxRepoMock = { [K in keyof ITransactionRepository]: ReturnType<typeof vi.fn> };

// completeContract reproduit fidèlement la garde du filtre Mongo : il ne règle qu'un
// contrat non terminal et non contesté, renvoyant null sinon (gel du règlement tant
// qu'une contestation est ouverte).
const makeContractRepo = (stored: Contract): ContractRepoMock => ({
  ensureIndexes: vi.fn(),
  getContracts: vi.fn(),
  getContractById: vi.fn().mockResolvedValue(stored),
  getContractByDocumensoDocumentId: vi.fn().mockResolvedValue(stored),
  completeContract: vi.fn(async () => {
    const terminal = stored.signatureStatus === "completed" || stored.signatureStatus === "rejected";
    if (terminal || stored.disputed) return null;
    return { ...stored, signatureStatus: "completed" as const };
  }),
  rejectContract: vi.fn(async () => {
    const terminal = stored.signatureStatus === "completed" || stored.signatureStatus === "rejected";
    if (terminal || stored.disputed) return null;
    return { ...stored, signatureStatus: "rejected" as const };
  }),
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

describe("handleDocumensoWebhookUseCase — dispute settlement freeze", () => {
  let txRepo: TxRepoMock;

  beforeEach(() => {
    vi.clearAllMocks();
    txRepo = makeTxRepo();
  });

  // Contrat contesté : le webhook de complétion ne doit PAS régler automatiquement (aucun mouvement d'argent).
  it("does NOT auto-settle a disputed contract when the completion webhook fires", async () => {
    const disputed = makeContract({ disputed: true, disputeReason: "no-show" });
    const contractRepo = makeContractRepo(disputed);

    const result = await handleDocumensoWebhookUseCase(
      contractRepo as unknown as IContractRepository,
      txRepo as unknown as ITransactionRepository,
    )({ event: "document.completed", payload: { id: 42, status: "COMPLETED" } });

    // La garde de contestation a rendu completeContract sans effet → aucun séquestre versé au prestataire.
    expect(txRepo.adjustBalance).not.toHaveBeenCalled();
    expect(txRepo.createTransactions).not.toHaveBeenCalled();
    // Le contrat est renvoyé intact (toujours pending + contesté).
    expect(result).toMatchObject({ signatureStatus: "pending", disputed: true });
  });

  // Contrat non contesté : le webhook de complétion règle bien le séquestre au prestataire.
  it("still settles a non-disputed contract to the provider on completion", async () => {
    const contractRepo = makeContractRepo(makeContract());

    const result = await handleDocumensoWebhookUseCase(
      contractRepo as unknown as IContractRepository,
      txRepo as unknown as ITransactionRepository,
    )({ event: "document.completed", payload: { id: 42, status: "COMPLETED" } });

    expect(txRepo.adjustBalance).toHaveBeenCalledTimes(1);
    expect(txRepo.adjustBalance).toHaveBeenCalledWith("provider-1", 10, undefined);
    expect(result).toMatchObject({ signatureStatus: "completed" });
  });
});
