// Suite de tests (couche use-cases) du cas d'usage de création de contrat. Vérifie l'ordre
// des opérations sensibles (mise sous séquestre du prix AVANT l'appel Documenso), les
// invariants de réservation (annonce active, prestataire = auteur, parties distinctes,
// solde suffisant, pas de doublon), et les chemins de compensation (remboursement du
// séquestre en cas d'échec Documenso ou de doublon en base, non-rollback quand seul le
// grand livre échoue).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { logger } from "@repo/shared";
import type { User } from "../../entities/user.entity.js";
import type { Contract } from "../../entities/contract.entity.js";
import type { Listing } from "../../entities/listing.entity.js";
import type { IUserRepository } from "../../repositories/User/user.repository.js";
import type { IListingRepository } from "../../repositories/Listing/listing.repository.js";
import type { IContractRepository } from "../../repositories/Contract/contract.repository.js";
import type { ITransactionRepository } from "../../repositories/Transaction/transaction.repository.js";
import type { GeneratedContractDocument, IDocumensoService } from "../../services/documenso.service.js";
import {
  ContractPartyNotFoundError,
  DuplicateContractError,
  InsufficientFundsError,
  ListingNotActiveError,
  ListingNotFoundError,
  NotListingProviderError,
  SamePartyError,
  createContractUseCase,
} from "./create-contract.use-case.js";

const makeUser = (id: string): User =>
  ({ id, email: `${id}@example.com`, firstName: id, lastName: "Doe" }) as unknown as User;

const makeUserRepo = (users: Record<string, User | null>): IUserRepository =>
  ({
    getUserById: vi.fn(async (id: string) => users[id] ?? null),
  }) as unknown as IUserRepository;

// L'annonce contre laquelle le contrat est réservé — districtId + prix en sont dérivés
// (jamais du client), et son status/authorId conditionnent les invariants de réservation.
const makeListing = (overrides: Partial<Listing> = {}): Listing =>
  ({
    id: "listing-1",
    status: "active",
    authorId: "provider-1",
    districtId: "district-1",
    price: 500,
    ...overrides,
  }) as unknown as Listing;

const makeListingRepo = (listing: Listing | null = makeListing()): IListingRepository =>
  ({
    getListingById: vi.fn(async () => listing),
  }) as unknown as IListingRepository;

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

// Champs fournis par le client uniquement ; districtId + prix viennent désormais de l'annonce.
const baseData = {
  listingId: "listing-1",
  providerId: "provider-1",
  beneficiaryId: "beneficiary-1",
};

const defaultUsers = () => ({
  "provider-1": makeUser("provider-1"),
  "beneficiary-1": makeUser("beneficiary-1"),
});

describe("createContractUseCase", () => {
  beforeEach(() => vi.clearAllMocks());

  // Le prix est mis sous séquestre (tryDebit) AVANT de générer le document Documenso.
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
      makeListingRepo(),
      makeUserRepo(defaultUsers()),
      documenso,
      txRepo,
    )(baseData);

    expect(calls).toEqual(["tryDebit", "generateContractDocument"]);
    expect(txRepo.tryDebit).toHaveBeenCalledWith("beneficiary-1", 500);
    expect(contract.id).toBe("contract-1");
    // La retenue au grand livre est enregistrée après l'existence du contrat, comme un transfer_out négatif.
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

  // Annonce introuvable → ListingNotFoundError, sans toucher à l'argent.
  it("throws ListingNotFoundError when the listing is missing (no money touched)", async () => {
    const txRepo = makeTxRepo();
    await expect(
      createContractUseCase(
        makeContractRepo(),
        makeListingRepo(null),
        makeUserRepo(defaultUsers()),
        makeDocumenso(),
        txRepo,
      )(baseData),
    ).rejects.toBeInstanceOf(ListingNotFoundError);
    expect(txRepo.tryDebit).not.toHaveBeenCalled();
  });

  // Annonce fermée → ListingNotActiveError, sans débit.
  it("throws ListingNotActiveError when the listing is closed", async () => {
    const txRepo = makeTxRepo();
    await expect(
      createContractUseCase(
        makeContractRepo(),
        makeListingRepo(makeListing({ status: "closed" })),
        makeUserRepo(defaultUsers()),
        makeDocumenso(),
        txRepo,
      )(baseData),
    ).rejects.toBeInstanceOf(ListingNotActiveError);
    expect(txRepo.tryDebit).not.toHaveBeenCalled();
  });

  // Bénéficiaire === prestataire → SamePartyError, sans débit.
  it("throws SamePartyError when beneficiary === provider", async () => {
    const txRepo = makeTxRepo();
    await expect(
      createContractUseCase(
        makeContractRepo(),
        makeListingRepo(),
        makeUserRepo(defaultUsers()),
        makeDocumenso(),
        txRepo,
      )({
        ...baseData,
        providerId: "beneficiary-1",
      }),
    ).rejects.toBeInstanceOf(SamePartyError);
    expect(txRepo.tryDebit).not.toHaveBeenCalled();
  });

  // providerId différent de l'auteur de l'annonce → NotListingProviderError, sans débit.
  it("throws NotListingProviderError when providerId isn't the listing author", async () => {
    const txRepo = makeTxRepo();
    await expect(
      createContractUseCase(
        makeContractRepo(),
        makeListingRepo(makeListing({ authorId: "someone-else" })),
        makeUserRepo(defaultUsers()),
        makeDocumenso(),
        txRepo,
      )(baseData),
    ).rejects.toBeInstanceOf(NotListingProviderError);
    expect(txRepo.tryDebit).not.toHaveBeenCalled();
  });

  // Si generateContractDocument échoue, la retenue de séquestre est remboursée (adjustBalance).
  it("refunds the escrow hold when generateContractDocument throws", async () => {
    const txRepo = makeTxRepo();
    const documenso = makeDocumenso({
      generateContractDocument: vi.fn(async () => {
        throw new Error("documenso boom");
      }),
    });
    const contractRepo = makeContractRepo();

    await expect(
      createContractUseCase(contractRepo, makeListingRepo(), makeUserRepo(defaultUsers()), documenso, txRepo)(baseData),
    ).rejects.toThrow("documenso boom");

    expect(txRepo.tryDebit).toHaveBeenCalledWith("beneficiary-1", 500);
    // Retenue annulée — aucun contrat persisté, aucune écriture au grand livre.
    expect(txRepo.adjustBalance).toHaveBeenCalledWith("beneficiary-1", 500);
    expect(contractRepo.createContract).not.toHaveBeenCalled();
    expect(txRepo.createTransactions).not.toHaveBeenCalled();
  });

  // Une clé dupliquée Mongo (code 11000) à la persistance devient DuplicateContractError, avec remboursement.
  it("maps a Mongo duplicate-key (11000) on persist to DuplicateContractError and refunds", async () => {
    const txRepo = makeTxRepo();
    const contractRepo = makeContractRepo({
      createContract: vi.fn(async () => {
        throw Object.assign(new Error("E11000 dup"), { code: 11000 });
      }),
    });

    await expect(
      createContractUseCase(
        contractRepo,
        makeListingRepo(),
        makeUserRepo(defaultUsers()),
        makeDocumenso(),
        txRepo,
      )(baseData),
    ).rejects.toBeInstanceOf(DuplicateContractError);

    expect(txRepo.adjustBalance).toHaveBeenCalledWith("beneficiary-1", 500);
    expect(txRepo.createTransactions).not.toHaveBeenCalled();
  });

  // Un contrat déjà persisté n'est PAS annulé si l'écriture au grand livre échoue.
  it("does NOT roll back a persisted contract when the ledger write fails", async () => {
    const loggerError = vi.spyOn(logger, "error").mockImplementation(() => {});
    const txRepo = makeTxRepo({
      createTransactions: vi.fn(async () => {
        throw new Error("ledger down");
      }),
    });
    const contractRepo = makeContractRepo();

    // L'échec du grand livre est avalé — le contrat est tout de même renvoyé avec succès.
    const contract = await createContractUseCase(
      contractRepo,
      makeListingRepo(),
      makeUserRepo(defaultUsers()),
      makeDocumenso(),
      txRepo,
    )(baseData);

    expect(contract.id).toBe("contract-1");
    // Pas de remboursement : l'argent est correctement retenu face à un contrat actif.
    expect(txRepo.adjustBalance).not.toHaveBeenCalled();
    expect(loggerError).toHaveBeenCalled();
    loggerError.mockRestore();
  });

  // Débit refusé → InsufficientFundsError, sans aucun travail externe (ni Documenso, ni persistance).
  it("throws InsufficientFundsError (no external work) when the debit fails", async () => {
    const txRepo = makeTxRepo({ tryDebit: vi.fn(async () => false) });
    const documenso = makeDocumenso();
    const contractRepo = makeContractRepo();

    await expect(
      createContractUseCase(contractRepo, makeListingRepo(), makeUserRepo(defaultUsers()), documenso, txRepo)(baseData),
    ).rejects.toBeInstanceOf(InsufficientFundsError);

    expect(documenso.generateContractDocument).not.toHaveBeenCalled();
    expect(contractRepo.createContract).not.toHaveBeenCalled();
    expect(txRepo.adjustBalance).not.toHaveBeenCalled();
  });

  // Un contrat actif en double est rejeté avant tout mouvement d'argent.
  it("rejects a duplicate active contract before touching money", async () => {
    const txRepo = makeTxRepo();
    const documenso = makeDocumenso();
    const contractRepo = makeContractRepo({
      findActiveContract: vi.fn(async () => ({ id: "existing" }) as Contract),
    });

    await expect(
      createContractUseCase(contractRepo, makeListingRepo(), makeUserRepo(defaultUsers()), documenso, txRepo)(baseData),
    ).rejects.toBeInstanceOf(DuplicateContractError);

    expect(txRepo.tryDebit).not.toHaveBeenCalled();
    expect(documenso.generateContractDocument).not.toHaveBeenCalled();
  });

  // Une partie manquante → ContractPartyNotFoundError, sans débit.
  it("throws ContractPartyNotFoundError when a party is missing (no debit)", async () => {
    const txRepo = makeTxRepo();
    const users = { "provider-1": makeUser("provider-1"), "beneficiary-1": null };

    await expect(
      createContractUseCase(
        makeContractRepo(),
        makeListingRepo(),
        makeUserRepo(users),
        makeDocumenso(),
        txRepo,
      )(baseData),
    ).rejects.toBeInstanceOf(ContractPartyNotFoundError);

    expect(txRepo.tryDebit).not.toHaveBeenCalled();
  });

  // Un contrat gratuit (prix 0) court-circuite tous les chemins liés à l'argent.
  it("skips all money paths for a free (price 0) contract", async () => {
    const txRepo = makeTxRepo();
    const contract = await createContractUseCase(
      makeContractRepo(),
      makeListingRepo(makeListing({ price: 0 })),
      makeUserRepo(defaultUsers()),
      makeDocumenso(),
      txRepo,
    )(baseData);

    expect(contract.id).toBe("contract-1");
    expect(txRepo.tryDebit).not.toHaveBeenCalled();
    expect(txRepo.createTransactions).not.toHaveBeenCalled();
  });
});
