import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Contract } from "../../entities/contract.entity.js";
import type { IContractRepository } from "../../repositories/Contract/contract.repository.js";
import { disputeContractUseCase, InvalidDisputeStateError } from "./dispute-contract.use-case.js";

// Suite de tests du cas d'usage de contestation : vérifie l'écriture atomique du
// signalement (chemin nominal), la classification 400 quand le contrat est déjà
// terminal, et la réponse 404 quand le contrat n'existe pas.

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

describe("disputeContractUseCase", () => {
  let repo: ContractRepoMock;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = makeContractRepo();
  });

  // Chemin nominal : le signalement est apposé atomiquement, le contrat mis à jour est renvoyé.
  it("stamps the dispute atomically and returns the updated contract", async () => {
    const disputed = makeContract({ disputed: true, disputeReason: "no-show" });
    repo.disputeContract.mockResolvedValue(disputed);

    const result = await disputeContractUseCase(repo as unknown as IContractRepository)("contract-1", {
      reason: "no-show",
    });

    expect(repo.disputeContract).toHaveBeenCalledWith("contract-1", "no-show");
    expect(result).toBe(disputed);
    // Pas de lecture-puis-écriture : le chemin nominal ne retombe jamais sur getContractById.
    expect(repo.getContractById).not.toHaveBeenCalled();
  });

  // Contrat déjà terminal : la garde atomique ne matche pas et la relecture classe en 400.
  it("rejects with InvalidDisputeStateError when the contract already went terminal", async () => {
    // La garde atomique n'a pas matché (un webhook concurrent a rejeté le contrat avant),
    // et la relecture montre un contrat terminal → non contestable.
    repo.disputeContract.mockResolvedValue(null);
    repo.getContractById.mockResolvedValue(makeContract({ signatureStatus: "rejected" }));

    await expect(
      disputeContractUseCase(repo as unknown as IContractRepository)("contract-1", { reason: "no-show" }),
    ).rejects.toBeInstanceOf(InvalidDisputeStateError);
  });

  // Contrat inexistant : la relecture renvoie null → réponse 404.
  it("returns null (404) when the contract does not exist", async () => {
    repo.disputeContract.mockResolvedValue(null);
    repo.getContractById.mockResolvedValue(null);

    const result = await disputeContractUseCase(repo as unknown as IContractRepository)("missing", {
      reason: "no-show",
    });

    expect(result).toBeNull();
  });
});
